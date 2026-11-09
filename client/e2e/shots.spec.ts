import { test } from '@playwright/test';

/** Screenshots for a visual check. Only runs when SHOTS_DIR is set. */
const dir = process.env.SHOTS_DIR;

test.describe('screenshots', () => {
  test.skip(!dir, 'Set SHOTS_DIR to write screenshots.');

  for (const [name, path] of [['landing', '/'], ['privacy', '/privacy'], ['app', '/app']] as const) {
    test(name, async ({ page }, info) => {
      await page.goto(path);
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${dir}/${name}-${info.project.name}.png` });
      if (name !== 'landing') return;
      if (info.project.name === 'mobile') {
        await page.screenshot({ path: `${dir}/landing-full-mobile.png`, fullPage: true });
        return;
      }
      // On large screens the landing page scrolls inside its window.
      for (const step of [1, 2, 3]) {
        await page.evaluate((n) => document.getElementById('main')?.scrollTo(0, n * 650), step);
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${dir}/landing-scroll${step}-desktop.png` });
      }
    });
  }
});
