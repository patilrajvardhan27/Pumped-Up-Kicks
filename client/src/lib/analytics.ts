import type { PostHog } from 'posthog-js';

/*
 * PostHog, behind one small interface. posthog-js is imported only after the
 * visitor agrees, so a decline costs no bundle and no network request.
 *
 * What leaves the browser is a short list of named events. Never put lecture
 * titles, transcript text or question text in the properties.
 */
const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export const analyticsConfigured = Boolean(TOKEN);

interface AnalyticsEvents {
  cta_clicked: { id: string };
  timeline_scrubbed: Record<string, never>;
  lecture_uploaded: { size_mb: number };
  question_asked: { scope: 'lecture' | 'subject' | 'library' | 'thread' };
  citation_clicked: { source: 'answer' | 'timeline' };
  notes_exported: Record<string, never>;
}

let client: PostHog | null = null;
let loading: Promise<PostHog> | null = null;

const uiHost = () => (HOST.includes('//eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com');

function load(): Promise<PostHog> {
  loading ??= import('posthog-js').then(({ default: posthog }) => {
    posthog.init(TOKEN as string, {
      // Same-origin proxy (see next.config.ts), which ad blockers leave alone.
      api_host: '/ingest',
      ui_host: uiHost(),
      defaults: '2026-05-30',
      // Lecture content is on screen in this app, so no screen recording, and no
      // autocapture of element text: only the explicit events above are sent.
      autocapture: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    });
    client = posthog;
    return posthog;
  });
  return loading;
}

/** Start (or resume) capturing. A no-op when no token is configured. */
export async function enableAnalytics(): Promise<void> {
  if (!analyticsConfigured) return;
  const posthog = await load();
  posthog.opt_in_capturing();
}

/** PostHog keeps its id in local storage and a cookie under these names. */
const isPosthogKey = (key: string) => key.startsWith('ph_') || key.startsWith('__ph_');

function purgeStoredIds(): void {
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      Object.keys(store).filter(isPosthogKey).forEach((key) => store.removeItem(key));
    }
  } catch {
    // Storage is blocked, so there is nothing stored to remove.
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const names = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter(isPosthogKey);
  for (const name of names) {
    // A cookie only goes if the Domain matches how it was set, so try the
    // host itself and then each parent: a.b.com, .a.b.com, .b.com.
    for (const domain of [null, ...cookieDomains(window.location.hostname)]) {
      const scope = domain ? `; Domain=${domain}` : '';
      document.cookie = `${name}=; Max-Age=0; Path=/${scope}; SameSite=Lax${secure}`;
    }
  }
}

/** The host and each parent suffix with at least two labels, e.g. a.b.com gives a.b.com and .b.com. */
function cookieDomains(host: string): string[] {
  if (/^[\d.]+$/.test(host) || host.includes(':')) return [];
  const labels = host.split('.');
  const out = [host];
  for (let i = 1; i < labels.length - 1; i += 1) out.push(`.${labels.slice(i).join('.')}`);
  return out;
}

/** Stop capturing and remove everything PostHog stored about this browser. */
export function disableAnalytics(): void {
  // No reset() here: it queues a deferred save of a brand new id that lands
  // after the purge below. Our own consent record decides whether PostHog loads
  // at all, so PostHog's stored opt-out flag is not needed either.
  client?.opt_out_capturing();
  purgeStoredIds();
}

export function identify(userId: string): void {
  client?.identify(userId);
}

export function resetIdentity(): void {
  client?.reset();
}

export function track<N extends keyof AnalyticsEvents>(name: N, props: AnalyticsEvents[N]): void {
  client?.capture(name, props);
}
