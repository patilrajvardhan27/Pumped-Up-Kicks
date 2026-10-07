import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

const originOf = (url: string | undefined): string | null => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

/** A Clerk publishable key is `pk_<env>_` + base64 of its Frontend API host. */
const clerkOrigin = (key: string | undefined): string | null => {
  const encoded = key?.split('_')[2];
  if (!encoded) return null;
  const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
  return originOf(`https://${host}`);
};

const api = originOf(process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:8000';
const clerk = clerkOrigin(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
// Lecture files are uploaded to, and played from, presigned R2 URLs. A custom
// storage domain can be added with NEXT_PUBLIC_STORAGE_ORIGINS (space separated).
const storage = ['https://*.r2.cloudflarestorage.com', process.env.NEXT_PUBLIC_STORAGE_ORIGINS];
const turnstile = 'https://challenges.cloudflare.com';

/*
 * PostHog is called through our own domain (/ingest) so ad blockers do not drop
 * it and the browser never talks to a third party directly, which also keeps
 * the CSP's connect-src free of it. EU projects set NEXT_PUBLIC_POSTHOG_HOST to
 * https://eu.i.posthog.com.
 */
const posthogHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/+$/, '');
const posthogAssets = posthogHost.replace('//us.i.', '//us-assets.i.').replace('//eu.i.', '//eu-assets.i.');

const list = (...sources: (string | null | undefined | false)[]) => sources.filter(Boolean).join(' ');

/*
 * Headers set here are static, so they cannot carry a per-request nonce and
 * script-src has to allow Next's inline bootstrap. Everything else is an
 * allowlist: what the page may connect to, load media from, or be framed by.
 */
const csp = [
  `default-src 'self'`,
  `script-src ${list(`'self'`, `'unsafe-inline'`, isDev && `'unsafe-eval'`, clerk, clerk && turnstile)}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src ${list(`'self'`, 'data:', 'blob:', clerk && 'https://img.clerk.com')}`,
  `font-src 'self' data:`,
  `connect-src ${list(`'self'`, api, clerk, clerk && 'https://clerk-telemetry.com', ...storage)}`,
  `media-src ${list(`'self'`, 'blob:', api, ...storage)}`,
  `worker-src 'self' blob:`,
  `frame-src ${list(`'self'`, clerk && turnstile)}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  !isDev && api.startsWith('https:') && 'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PostHog's API paths end in a slash, which Next would otherwise redirect away.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: `${posthogAssets}/static/:path*` },
      { source: '/ingest/array/:path*', destination: `${posthogAssets}/array/:path*` },
      { source: '/ingest/:path*', destination: `${posthogHost}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // Browsers ignore this over plain http, so it only takes effect once the
          // site is served on https. The http-to-https redirect itself belongs to
          // the host or ingress. No `preload`: that is hard to undo.
          ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
