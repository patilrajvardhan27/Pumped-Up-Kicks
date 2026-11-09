# Client

Next.js 16 (App Router, Turbopack), React 19, TypeScript 6, Tailwind CSS 4, ESLint 9. The marketing page, the lecture workspace, and the privacy and terms pages.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Node 20.9 or newer. The API must be running on port 8000; see [../server/README.md](../server/README.md).

## Environment

Only `NEXT_PUBLIC_` variables are read, and all are visible in the browser. Never put a secret in them. See `.env.example`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API origin. Defaults to `http://localhost:8000`. A production build rejects a non-local `http://` value. |
| `NEXT_PUBLIC_SITE_URL` | Public address, for canonical links, the sitemap and social previews. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Enables Clerk sign-in. Empty means local dev mode with no sign-in. |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | Turns on PostHog analytics and the cookie banner. Empty switches both off. |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` (default) or `https://eu.i.posthog.com`, called through the `/ingest` proxy. |
| `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` | Named as responsible on the privacy policy and terms. Set both before launch. |
| `NEXT_PUBLIC_STORAGE_ORIGINS` | Optional, space separated. Extra upload and playback origins, added to the CSP. |
| `NEXT_PUBLIC_IDLE_MINUTES` | Optional. Minutes of inactivity before sign-out. Defaults to 30. |

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run e2e        # Playwright with axe, desktop and mobile; starts the dev server
```

## Structure

```
src/
  app/            routes and layouts only (/, /app, /privacy, /terms)
  components/
    ui/           buttons, inputs, cards, badges, alerts, dialog, icons
    shell/        wallpapered desktop, document window, menu bar
    landing/      the marketing page
    workspace/    chat, video, upload, sidebar, study, search, canvas, documents
    consent/      cookie banner and analytics provider
    legal/        privacy and terms content
    providers/    Clerk, auth token bridge, motion
  hooks/          stateful logic, including useIdleSignOut
  lib/            formatting, timestamps, analytics, consent, site config
  services/       API clients
  styles/         tokens.css, motion.css, globals.css
  types/          API and chat types
e2e/              Playwright specs
```

## Design system

The specification is [../docs/DESIGN.md](../docs/DESIGN.md). Every colour, type role, radius and motion value lives in `src/styles/tokens.css`; Tailwind's defaults are cleared, so an off-token value does not compile. Icons are re-exported from `components/ui/icons.tsx`. Motion elements come from `motion/react-m` under the single `LazyMotion` in `components/providers/MotionProvider.tsx`.

## Security headers

`next.config.ts` sets a Content-Security-Policy (allowing only the API origin, the Clerk Frontend API derived from the publishable key, and R2), `Strict-Transport-Security` outside development, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` and `Permissions-Policy`. The app sets no cookies of its own; sessions are Clerk bearer tokens.
