/**
 * Mock code templates for the Coder agent.
 *
 * v1 = first draft, deliberately imperfect (missing error handling, edge cases).
 * v2 = revised version that addresses the Reviewer's flagged issues.
 *
 * Real-mode swap: replace this with an LLM call (Claude Sonnet) given the PM's
 * requirements + the Reviewer's previous feedback as a prompt.
 */

export type Language = 'python' | 'typescript';

export interface CodeArtifact {
  language: Language;
  code: string;
  /** Brief description of what changed since v1 — used by the Reviewer's narrative. */
  notes?: string;
}

export interface ReviewIssue {
  severity: 'major' | 'minor';
  text: string;
}

/* ─────────────── Topic-aware mock requirements ─────────────── */

export interface Requirements {
  goal: string;
  acceptance: string[];
  edgeCases: string[];
}

export function mockRequirements(prompt: string): Requirements {
  return {
    goal: prompt.trim(),
    acceptance: [
      'Function returns correct output for the documented inputs',
      'Has type signatures (or type hints in Python)',
      'Includes a brief docstring / JSDoc',
    ],
    edgeCases: [
      'Empty input',
      'Malformed / non-conforming input',
      'Large inputs do not blow memory',
    ],
  };
}

/* ─────────────── Code templates ─────────────── */

export function mockCodeV1(prompt: string, language: Language): CodeArtifact {
  const safeName = slug(prompt) || 'process';

  if (language === 'python') {
    return {
      language: 'python',
      code: `def ${safeName}(data):
    # First pass: happy path only
    result = []
    for item in data.split(','):
        result.append(item)
    return result
`,
    };
  }

  return {
    language: 'typescript',
    code: `export function ${camel(safeName)}(data) {
  // First pass: happy path only
  const result = [];
  for (const item of data.split(',')) {
    result.push(item);
  }
  return result;
}
`,
  };
}

export function mockCodeV2(prompt: string, language: Language): CodeArtifact {
  const safeName = slug(prompt) || 'process';

  if (language === 'python') {
    return {
      language: 'python',
      code: `from typing import List


def ${safeName}(data: str) -> List[str]:
    """Split a comma-separated string and return trimmed, non-empty parts.

    Handles empty / whitespace-only input by returning an empty list.
    """
    if not data or not data.strip():
        return []
    return [item.strip() for item in data.split(',') if item.strip()]
`,
      notes: 'Added type hints, docstring, empty-input guard, and whitespace trimming.',
    };
  }

  return {
    language: 'typescript',
    code: `/**
 * Split a comma-separated string and return trimmed, non-empty parts.
 * Handles empty / whitespace-only input by returning [].
 */
export function ${camel(safeName)}(data: string): string[] {
  if (!data || !data.trim()) return [];
  return data
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
`,
      notes: 'Added explicit types, JSDoc, empty-input guard, and whitespace trimming.',
  };
}

/* ─────────────── Reviewer findings ─────────────── */

export function mockReviewV1(): { verdict: 'REVISE'; issues: ReviewIssue[] } {
  return {
    verdict: 'REVISE',
    issues: [
      { severity: 'major', text: 'No handling for empty input — function will return [""] instead of [].' },
      { severity: 'minor', text: 'Missing type signatures and docstring.' },
      { severity: 'minor', text: 'Whitespace around items is not trimmed.' },
    ],
  };
}

export function mockReviewV2(): { verdict: 'APPROVE'; issues: [] } {
  return {
    verdict: 'APPROVE',
    issues: [],
  };
}

/* ─────────────── helpers ─────────────── */

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function camel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
