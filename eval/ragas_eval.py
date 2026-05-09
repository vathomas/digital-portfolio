#!/usr/bin/env python3
"""
Ragas evaluation script — Stage B CI gate.

Reads eval/questions.jsonl (n=50 Q&A pairs), sends each question to the
portfolio chatbot API on the Vercel Preview, then scores the responses
using the Ragas framework with gpt-4o-mini as the judge LLM.

Metrics computed:
  - faithfulness         (answer supported by retrieved context)
  - answer_relevancy     (answer addresses the question)
  - context_precision    (retrieved context is precise / not noisy)
  - context_recall       (retrieved context covers the ground truth)

Exit codes:
  0 — all metrics meet the gate thresholds
  1 — one or more metrics below threshold (blocks promotion to production)

Usage (CI):
  python eval/ragas_eval.py --base-url ${{ steps.vercel.outputs.url }}

Usage (local):
  pip install ragas openai requests
  OPENAI_API_KEY=sk-... python eval/ragas_eval.py --base-url http://localhost:4321

Environment variables (required):
  OPENAI_API_KEY  — judge LLM (gpt-4o-mini). Must be set in CI secrets.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests


# ── Gate thresholds ──────────────────────────────────────────────────────────
THRESHOLDS = {
    "faithfulness": 0.80,
    "answer_relevancy": 0.75,
    "context_precision": 0.70,
    "context_recall": 0.70,
}

# ── Retry settings for the chat API ──────────────────────────────────────────
MAX_RETRIES = 3
RETRY_BACKOFF_S = 2.0
REQUEST_TIMEOUT_S = 30


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ragas evaluation gate")
    parser.add_argument(
        "--base-url",
        required=True,
        help="Base URL of the deployed app (e.g. https://my-preview.vercel.app)",
    )
    parser.add_argument(
        "--questions",
        default=str(Path(__file__).parent / "questions.jsonl"),
        help="Path to the JSONL file with question/ground_truth pairs",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).parent / "results.json"),
        help="Where to write the scored results JSON",
    )
    parser.add_argument(
        "--max-questions",
        type=int,
        default=0,
        help="Cap the number of questions evaluated (0 = all). Useful for smoke-testing.",
    )
    return parser.parse_args()


def load_questions(path: str) -> list[dict]:
    questions = []
    with open(path, encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as exc:
                print(f"[WARN] questions.jsonl line {lineno} is invalid JSON — skipping: {exc}")
                continue
            if "question" not in obj or "ground_truth" not in obj:
                print(f"[WARN] questions.jsonl line {lineno} missing 'question' or 'ground_truth' — skipping")
                continue
            questions.append(obj)
    return questions


def build_headers() -> dict:
    """
    Build HTTP headers for chat API calls.
    Includes Vercel's Deployment Protection bypass header when available so
    auth-walled Preview deployments are reachable from CI.
    """
    headers = {"Content-Type": "application/json"}
    bypass = os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET", "").strip()
    if bypass:
        headers["x-vercel-protection-bypass"] = bypass
        headers["x-vercel-set-bypass-cookie"] = "true"
    return headers


def call_chat_api(base_url: str, question: str) -> dict | None:
    """
    POST /api/chat and return the parsed JSON body.
    Returns None on unrecoverable failure after MAX_RETRIES.
    """
    url = base_url.rstrip("/") + "/api/chat"
    payload = {"message": question}
    headers = build_headers()

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(
                url,
                json=payload,
                timeout=REQUEST_TIMEOUT_S,
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as exc:
            print(f"  [attempt {attempt}/{MAX_RETRIES}] HTTP error: {exc}")
        except requests.exceptions.RequestException as exc:
            print(f"  [attempt {attempt}/{MAX_RETRIES}] Request error: {exc}")

        if attempt < MAX_RETRIES:
            time.sleep(RETRY_BACKOFF_S * attempt)

    return None


def collect_responses(base_url: str, questions: list[dict]) -> list[dict]:
    """
    Send each question to the chat API and collect structured rows
    suitable for Ragas evaluation.
    """
    rows = []
    total = len(questions)

    for idx, qa in enumerate(questions, start=1):
        q = qa["question"]
        gt = qa["ground_truth"]
        print(f"[{idx:02d}/{total}] {q[:72]}{'…' if len(q) > 72 else ''}")

        result = call_chat_api(base_url, q)
        if result is None:
            print("       ↳ FAILED (skipping)")
            continue

        answer = result.get("answer", "")
        contexts = result.get("contexts", [])

        if not answer:
            print("       ↳ empty answer (skipping)")
            continue

        rows.append(
            {
                "user_input": q,
                "response": answer,
                "retrieved_contexts": contexts if contexts else ["(no context retrieved)"],
                "reference": gt,
            }
        )
        print(f"       ↳ OK  answer={len(answer)} chars  contexts={len(contexts)}")

    return rows


def run_ragas(rows: list[dict]) -> dict:
    """
    Build a Ragas Dataset from the collected rows and run the four metrics.
    Returns a dict of { metric_name: float } scores.
    """
    # Late imports so the script fails fast with a clear message if ragas isn't installed,
    # rather than at import time where the error is harder to read in CI logs.
    try:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import (
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        )
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings
        from ragas.llms import LangchainLLMWrapper
        from ragas.embeddings import LangchainEmbeddingsWrapper
    except ImportError as exc:
        print(f"\n[ERROR] Missing dependency: {exc}")
        print("Run: pip install ragas openai requests langchain-openai datasets")
        sys.exit(1)

    dataset = Dataset.from_list(rows)

    judge_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o-mini", temperature=0))
    judge_embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model="text-embedding-3-small"))

    metrics = [faithfulness, answer_relevancy, context_precision, context_recall]
    for m in metrics:
        m.llm = judge_llm
        if hasattr(m, "embeddings"):
            m.embeddings = judge_embeddings

    result = evaluate(dataset=dataset, metrics=metrics)

    scores = {}
    for metric in metrics:
        key = metric.name
        val = result[key]
        # Ragas returns either a float or a list; normalise to float.
        scores[key] = float(val) if not hasattr(val, "__iter__") else float(sum(val) / len(val))

    return scores


def check_thresholds(scores: dict) -> bool:
    """Returns True if all thresholds pass, False otherwise."""
    passed = True
    for metric, threshold in THRESHOLDS.items():
        score = scores.get(metric, 0.0)
        status = "✅" if score >= threshold else "❌"
        print(f"  {status}  {metric:<25} {score:.4f}  (threshold: {threshold:.2f})")
        if score < threshold:
            passed = False
    return passed


def main() -> None:
    args = parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        print("[ERROR] OPENAI_API_KEY environment variable is not set.")
        sys.exit(1)

    # ── Load questions ────────────────────────────────────────────────────────
    print(f"\nLoading questions from {args.questions}")
    questions = load_questions(args.questions)
    if not questions:
        print("[ERROR] No valid questions found.")
        sys.exit(1)

    if args.max_questions and args.max_questions < len(questions):
        print(f"Capping evaluation to {args.max_questions} questions (--max-questions flag)")
        questions = questions[: args.max_questions]

    print(f"Loaded {len(questions)} question(s).\n")

    # ── Query the chat API ────────────────────────────────────────────────────
    print(f"Querying {args.base_url}/api/chat …\n")
    rows = collect_responses(args.base_url, questions)

    if not rows:
        print("\n[ERROR] No responses collected — cannot run Ragas evaluation.")
        sys.exit(1)

    print(f"\nCollected {len(rows)}/{len(questions)} successful responses.\n")

    # ── Run Ragas ─────────────────────────────────────────────────────────────
    print("Running Ragas evaluation (judge: gpt-4o-mini) …\n")
    scores = run_ragas(rows)

    # ── Write results ─────────────────────────────────────────────────────────
    output = {
        "scores": scores,
        "thresholds": THRESHOLDS,
        "questions_evaluated": len(rows),
        "questions_total": len(questions),
    }
    Path(args.output).write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nResults written to {args.output}\n")

    # ── Gate check ────────────────────────────────────────────────────────────
    print("─" * 55)
    print("Metric scores vs. thresholds:")
    passed = check_thresholds(scores)
    print("─" * 55)

    if passed:
        print("\n✅ All thresholds met — Stage B gate PASSED.")
        sys.exit(0)
    else:
        print("\n❌ One or more thresholds not met — Stage B gate FAILED.")
        print("   Fix retrieval quality before merging to production.")
        sys.exit(1)


if __name__ == "__main__":
    main()
