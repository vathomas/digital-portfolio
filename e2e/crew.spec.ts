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
    await page.goto('/crew');

    const input = page.getByPlaceholder('Describe a function for the crew to build…');
    await input.fill('a function that calculates fibonacci numbers');

    const submitBtn = page.getByRole('button', { name: /build|run|start/i }).last();
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

    // The Mermaid chart is rendered as an inline SVG by CrewFlowChart
    // It is present even before a run starts (idle state shows the graph)
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 10_000 });
  });
});
