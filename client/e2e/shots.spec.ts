import { test } from '@playwright/test';

/** Screenshots for a visual check. Only runs when SHOTS_DIR is set. */
const dir = process.env.SHOTS_DIR;

const PAGES = [
  ['landing', '/'],
  ['privacy', '/privacy'],
  ['app', '/app'],
  ['account', '/app/account'],
] as const;

test.describe('screenshots', () => {
  test.skip(!dir, 'Set SHOTS_DIR to write screenshots.');

  for (const [name, path] of PAGES) {
    test(name, async ({ page }, info) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${dir}/${name}-${info.project.name}.png`, fullPage: name === 'landing' });
    });
  }
});
