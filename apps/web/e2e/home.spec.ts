import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { SHOWN_MICROSITES } from '../src/lib/microsites';

test.describe('home', () => {
  test('@critical renders the landing page with microsite cards', async ({ page }) => {
    // Relative URL (no leading slash) so it resolves against the baseURL path
    // (the site may be served under a base path).
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // One card per published microsite, named after that story's own title.
    for (const microsite of SHOWN_MICROSITES) {
      await expect(page.getByRole('link', { name: microsite.title })).toHaveCount(1);
    }
  });

  test('@critical opens a microsite story from its card', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('link', { name: /peaked at 14.8 percent in April 2020/i }).click();
    await expect(page.getByRole('img', { name: /unemployment rate/i })).toBeVisible();
    await expect(page.getByText('Sources and further reading')).toBeVisible();
  });

  test('@critical @a11y no a11y violations on the landing page', async ({ page }) => {
    await page.goto('./');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('@smoke shows a plausible live unemployment rate', async ({ page }) => {
    await page.goto('./economy/jobless-rate');
    const latest = await page.getAttribute('[data-testid="jobless-latest"]', 'data-value');
    expect(latest).not.toBeNull();
    const rate = Number(latest);
    expect(Number.isFinite(rate)).toBe(true);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(25);
  });

  test('@smoke pins the pandemic peak', async ({ page }) => {
    await page.goto('./economy/jobless-rate');
    const peak = await page.getAttribute('[data-testid="jobless-peak"]', 'data-value');
    expect(Number(peak)).toBeCloseTo(14.8, 1);
  });
});
