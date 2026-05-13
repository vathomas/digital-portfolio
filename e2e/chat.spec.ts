import { test, expect } from '@playwright/test';

/**
 * Showcase 1 — Recursive Portfolio Chatbot
 * Route: /about
 *
 * Verifies:
 *  - Page loads and the chat input is visible
 *  - Submitting a question receives a non-empty assistant reply
 *  - The thoughts trace is accessible and contains at least one step
 */
test.describe('Chat widget (/about)', () => {
  test('page loads with chat input', async ({ page }) => {
    await page.goto('/about');
    const input = page.getByPlaceholder("Ask about Thomas's background, skills, or projects…");
    await expect(input).toBeVisible();
  });

  test('submitting a question produces an assistant reply', async ({ page }) => {
    // Default per-test cap is 30 s, but the chat round-trip (retrieve → grade
    // → optional rewrite → generate) on a cold preview can take 25–40 s.
    // Lift the budget so the 30 s toBeVisible below has room to actually run.
    test.setTimeout(90_000);

    await page.goto('/about');

    const input = page.getByPlaceholder("Ask about Thomas's background, skills, or projects…");
    await input.fill('Where does Thomas currently work?');
    await input.press('Enter');

    // Wait up to 60 s for an assistant message — covers real LLM cold start
    const assistantMsg = page.locator('[data-role="assistant"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });
    const text = await assistantMsg.innerText();
    expect(text.trim().length).toBeGreaterThan(20);
  });

  test('thoughts trace renders at least one step after reply', async ({ page }) => {
    // Same cold-start consideration as the previous test.
    test.setTimeout(90_000);

    await page.goto('/about');

    const input = page.getByPlaceholder("Ask about Thomas's background, skills, or projects…");
    await input.fill('What certifications does Thomas have?');
    await input.press('Enter');

    // Enable the "See Thoughts" toggle once a reply is visible
    const assistantMsg = page.locator('[data-role="assistant"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 60_000 });

    // Target the checkbox specifically — the previous locator was ambiguous
    // because the <label> wraps the <input>, so both elements expose the
    // accessible name "🧠 See Thoughts" and Playwright strict mode rejects.
    const toggle = page.getByRole('checkbox', { name: /See Thoughts/i });
    if (await toggle.isVisible()) {
      await toggle.check();
      // At least one thought step should now be visible
      const thoughtStep = page.locator('text=retrieve').or(page.locator('text=generate')).first();
      await expect(thoughtStep).toBeVisible({ timeout: 5_000 });
    }
  });
});
