import { describe, it, expect, vi, afterEach } from 'vitest';
import { TOKEN_CAPS, WORD_BUDGETS, checkFinishReason } from './llm-caps';

describe('TOKEN_CAPS', () => {
  it('defines a cap for every operation', () => {
    // If a new op is added without sizing it here, the test suite calls it out.
    const expected = [
      'chatGrade',
      'chatRewrite',
      'chatGenerate',
      'researchPlan',
      'researchFactcheck',
      'researchSummarize',
      'crewPm',
      'crewCoder',
      'crewReviewer',
      'playgroundPlanner',
    ];
    for (const key of expected) {
      expect(TOKEN_CAPS).toHaveProperty(key);
      expect(typeof (TOKEN_CAPS as Record<string, number>)[key]).toBe('number');
      expect((TOKEN_CAPS as Record<string, number>)[key]).toBeGreaterThan(0);
    }
  });

  it('caps stay under a sensible per-call ceiling', () => {
    // Even the largest cap (summarize/coder) should be under 3000 — beyond
    // that the financial guardrail loses its bite (>$0.045 per single call).
    for (const [op, cap] of Object.entries(TOKEN_CAPS)) {
      expect(cap, `${op} cap`).toBeLessThanOrEqual(3000);
    }
  });
});

describe('WORD_BUDGETS', () => {
  it('keeps word budget proportional to token cap (≤ 0.85 ratio)', () => {
    // 1 token ≈ 0.75 English words, so budget < cap protects against the
    // model self-pacing into the hard cap and clipping.
    const pairs: [keyof typeof WORD_BUDGETS, keyof typeof TOKEN_CAPS][] = [
      ['chatGenerate', 'chatGenerate'],
      ['researchPlan', 'researchPlan'],
      ['researchSummarize', 'researchSummarize'],
      ['crewCoder', 'crewCoder'],
      ['playgroundPlanner', 'playgroundPlanner'],
    ];
    for (const [budgetKey, capKey] of pairs) {
      const budget = WORD_BUDGETS[budgetKey];
      const cap = TOKEN_CAPS[capKey];
      expect(budget / cap, `${budgetKey} ratio`).toBeLessThanOrEqual(0.85);
    }
  });
});

describe('checkFinishReason', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  afterEach(() => warnSpy.mockClear());

  it('returns a truncation note when finishReason is "length"', () => {
    const note = checkFinishReason('length', 'chat.generate');
    expect(note).toMatch(/truncated/i);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('chat.generate');
  });

  it('returns a safety note when blocked by content filter', () => {
    const note = checkFinishReason('content-filter', 'research.summarize');
    expect(note).toMatch(/safety/i);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null on clean stop', () => {
    expect(checkFinishReason('stop', 'chat.generate')).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns null for tool-calls finish (expected for tool agents)', () => {
    expect(checkFinishReason('tool-calls', 'playground.planner')).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns null when finishReason is undefined', () => {
    expect(checkFinishReason(undefined, 'chat.generate')).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
