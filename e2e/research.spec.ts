import { test, expect } from '@playwright/test';

/**
 * Showcase 2 — Deep Research Agent
 * Route: /research
 *
 * Verifies:
 *  - Page loads and the topic input is visible
 *  - Submitting a topic causes SSE thought events to stream in
 *  - The PDF download link appears once the run is complete
 */
test.describe('Deep Research Agent (/research)', () => {
  test('page loads with topic input', async ({ page }) => {
    await page.goto('/research');
    const input = page.getByPlaceholder("Research topic, e.g. 'NVIDIA H200 benchmarks'…");
    await expect(input).toBeVisible();
  });

  test('submitting a topic streams thought events', async ({ page }) => {
    await page.goto('/research');

    const input = page.getByPlaceholder("Research topic, e.g. 'NVIDIA H200 benchmarks'…");
    await input.fill('transformer attention mechanisms');

    const submitBtn = page.getByRole('button', { name: /run|research|start/i }).last();
    await submitBtn.click();

    // At least one thought event should appear — covers the plan node
    // Give it 45 s to handle cold-start LLM latency
    const thoughtEntry = page
      .locator('text=plan')
      .or(page.locator('text=search'))
      .or(page.locator('text=PLAN'))
      .first();
    await expect(thoughtEntry).toBeVisible({ timeout: 45_000 });
  });

  test('PDF download link appears after run completes', async ({ page }) => {
    await page.goto('/research');

    const input = page.getByPlaceholder("Research topic, e.g. 'NVIDIA H200 benchmarks'…");
    await input.fill('LLM context window scaling');

    const submitBtn = page.getByRole('button', { name: /run|research|start/i }).last();
    await submitBtn.click();

    // Wait for the download link — full pipeline can take up to 90 s
    const pdfLink = page.getByRole('link', { name: /download pdf/i });
    await expect(pdfLink).toBeVisible({ timeout: 90_000 });

    const href = await pdfLink.getAttribute('href');
    expect(href).toMatch(/\/api\/research-pdf\?id=/);
  });
});
