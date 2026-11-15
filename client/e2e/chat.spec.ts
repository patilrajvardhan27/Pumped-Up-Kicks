import { expect, test, type Page } from '@playwright/test';
import { USAGE_NEAR_LIMIT, VIDEOS } from '../src/stories/fixtures';
import { recordedAnswer } from '../src/stories/sse';

/*
 * The real app, end to end, with the API answered from the same recorded data
 * the stories used. It checked the chat worked through the app store: asking,
 * streaming, the new thread showing up in the list, and opening it again.
 */
const API = 'http://localhost:8000';
const SSE = recordedAnswer().map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

async function fakeApi(page: Page) {
  let saved = false;
  const listCalls: string[] = [];
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body: unknown) => route.fulfill({ json: body });

    if (url.pathname === '/health') return json({ status: 'ok' });
    if (url.pathname === '/api/videos') return json({ total: VIDEOS.length, videos: VIDEOS });
    if (url.pathname === '/api/chat/usage') return json(USAGE_NEAR_LIMIT);
    if (url.pathname === '/api/chat/stream' && method === 'POST') {
      saved = true;
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: SSE });
    }
    if (url.pathname === '/api/chat/conversations') {
      listCalls.push(url.search);
      return json(saved ? [{ id: 101, title: 'Why does the gradient vanish?', scope: 'all', video_id: null, created_at: '2026-11-15T10:00:00Z', updated_at: '2026-11-15T10:00:00Z', message_count: 2 }] : []);
    }
    if (url.pathname.startsWith('/api/canvas')) return json({ connected: false, schools: [], personal_tokens_allowed: false });
    return json([]);
  });
  return { listCalls };
}

test('a question streams an answer, and the new chat appears in the list', async ({ page }) => {
  const { listCalls } = await fakeApi(page);
  await page.goto('/app');

  const box = page.getByRole('textbox', { name: 'Your question' });
  await expect(box).toBeEnabled();
  const before = listCalls.length;
  await box.fill('Why does the gradient vanish?');
  await box.press('Enter');

  await expect(page.getByText(/The lecture gave three fixes/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play from 12:04' }).first()).toBeVisible();
  // The finished answer bumped the thread lists, so they fetched again and showed the new chat.
  await expect.poll(() => listCalls.length).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: /Why does the gradient vanish\?/ }).first()).toBeVisible();
});

test('Shift+Enter adds a line and Enter sends', async ({ page }) => {
  await fakeApi(page);
  await page.goto('/app');
  const box = page.getByRole('textbox', { name: 'Your question' });
  await expect(box).toBeEnabled();
  await box.click();
  await page.keyboard.type('First line');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('second line');
  await expect(box).toHaveValue('First line\nsecond line');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /First line/ })).toBeVisible();
});
