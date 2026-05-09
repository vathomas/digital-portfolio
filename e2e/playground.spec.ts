import { test, expect } from '@playwright/test';

/**
 * Showcase 4 — Agent Playground
 * Route: /dashboard (AgentPlayground section inside AgentDashboard)
 *
 * Verifies:
 *  - Page loads and the playground input is visible
 *  - Asking a weather question triggers a tool trace with an action step
 *  - The trace shows at least one tool being called
 */
test.describe('Agent Playground (/dashboard)', () => {
  test('page loads with playground input', async ({ page }) => {
    await page.goto('/dashboard');
    const input = page.getByPlaceholder(
      'Ask the agent something it needs to use tools to answer…',
    );
    await expect(input).toBeVisible({ timeout: 15_000 });
  });

  test('weather query produces a tool-use trace', async ({ page }) => {
    await page.goto('/dashboard');

    const input = page.getByPlaceholder(
      'Ask the agent something it needs to use tools to answer…',
    );
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill("What's the weather in London?");
    await input.press('Enter');

    // ReAct trace should show an action or observation step — allow 30 s
    const traceEntry = page
      .locator('text=get_weather')
      .or(page.locator('text=ACTION'))
      .or(page.locator('text=action'))
      .or(page.locator('text=weather'))
      .first();
    await expect(traceEntry).toBeVisible({ timeout: 30_000 });
  });

  test('trace lists at least one tool in the tools-used footer', async ({ page }) => {
    await page.goto('/dashboard');

    const input = page.getByPlaceholder(
      'Ask the agent something it needs to use tools to answer…',
    );
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill('What time is it?');
    await input.press('Enter');

    // "Tools called:" label appears in the completion footer
    const toolsLabel = page.getByText('Tools called:');
    await expect(toolsLabel).toBeVisible({ timeout: 30_000 });
  });
});
