import { test, expect } from '@playwright/test';

/**
 * Showcase 3 — Crew Orchestrator
 * Route: /crew
 *
 * Verifies:
 *  - Page loads and the prompt input is visible
 *  - Submitting a prompt causes thought events to stream into the transcript
 *  - The Mermaid flowchart SVG renders (CrewFlowChart island)
 */
test.describe('Crew Orchestrator (/crew)', () => {
  test('page loads with prompt input', async ({ page }) => {
    await page.goto('/crew');
    const input = page.getByPlaceholder('Describe a function for the crew to build…');
    await expect(input).toBeVisible();
  });

  test('submitting a prompt streams crew transcript entries', async ({ page }) => {
    // LLM cold-start on the preview deployment can blow past the default 30 s
    // per-test cap; widen the budget so the 45 s waitForVisible below can run.
    test.setTimeout(90_000);

    await page.goto('/crew');

    const input = page.getByPlaceholder('Describe a function for the crew to build…');
    await input.fill('a function that calculates fibonacci numbers');

    // The submit button is disabled until React hydration runs and updates
    // its state from the controlled input. Wait for it to become enabled
    // before clicking — avoids a multi-second click-retry storm if the
    // island hasn't hydrated yet.
    const submitBtn = page.getByRole('button', { name: /dispatch|build|run|start/i }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
    await submitBtn.click();

    // Crew transcript should start populating — allow 45 s for LLM cold start
    const logEntry = page
      .locator('text=planner')
      .or(page.locator('text=PLANNER'))
      .or(page.locator('text=coder'))
      .or(page.locator('text=CODER'))
      .first();
    await expect(logEntry).toBeVisible({ timeout: 45_000 });
  });

  test('flowchart SVG is rendered on the page', async ({ page }) => {
    await page.goto('/crew');

    // Scope the SVG locator to the main content area. The new mobile-nav
    // hamburger button also contains an <svg>, and at the default Playwright
    // viewport the button is display:none, so `page.locator('svg').first()`
    // resolved to a hidden element and the assertion failed. Mermaid's SVG
    // lives inside <main>, which is unambiguous.
    const svg = page.locator('main svg').first();
    await expect(svg).toBeVisible({ timeout: 10_000 });
  });
});
