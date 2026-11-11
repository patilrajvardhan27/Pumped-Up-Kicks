import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ANALYTICS = Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);

test.describe('landing', () => {
  test('renders with a visible primary call to action', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const cta = page.getByRole('link', { name: 'Start studying free' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/app');
  });

  test('shows a visible focus indicator on the first Tab stop', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus-visible').first();
    await expect(focused).toBeVisible();
    const outline = await focused.evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});

test.describe('consent banner', () => {
  test.skip(!ANALYTICS, 'Analytics is not configured (no NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN), so no banner is shown.');

  test('can be declined and stays gone', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);
  });

  test('can be accepted', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);
  });
});

test.describe('other routes', () => {
  test('privacy renders', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('terms renders', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('an unknown route shows the 404 page', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Nothing at this timestamp.' })).toBeVisible();
  });

  test('the workspace loads in dev auth', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByText('Dev mode')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add a lecture' })).toBeVisible();
  });
});

test.describe('accessibility', () => {
  for (const path of ['/', '/privacy', '/terms', '/acceptable-use', '/cookies', '/security', '/app', '/app/account', '/no-such-page']) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});
