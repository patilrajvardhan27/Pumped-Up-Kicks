# Pumped Up Kicks - Frontend

Ask your recorded lectures a question and get an answer with the timestamp it came from.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API must be running on port 8000; see `../server/README.md`.

## Stack

Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, TypeScript 6, ESLint 9.

- `motion` for drag, layout and exit animation. Loaded once through `LazyMotion` in `components/providers/MotionProvider.tsx`; import elements from `motion/react-m`.
- `@phosphor-icons/react` for icons. Every icon is re-exported from `components/ui/icons.tsx`; add new ones there, not inline.

## Environment

Only `NEXT_PUBLIC_` variables are read.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API origin. Defaults to `http://localhost:8000`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Enables Clerk sign-in. Without it the app runs in dev auth mode. |
| `NEXT_PUBLIC_SITE_URL` | Public https address. Used for canonical links, the sitemap and social previews. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | Turns on PostHog analytics and the cookie banner. Leave empty to switch both off. |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` (default) or `https://eu.i.posthog.com`. Called through the `/ingest` proxy. |
| `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL` | Who the privacy policy and terms name as responsible, and where to write. Set both before launch. |
| `NEXT_PUBLIC_STORAGE_ORIGINS` | Optional, space separated. Extra origins lecture files are uploaded to or played from, added to the Content-Security-Policy. |

## Structure

```
src/
  app/          routes and layouts only
  components/
    ui/         buttons, inputs, cards, badges, alerts, icons
    shell/      the wallpapered desktop and floating menu bar shared by both routes
    landing/    the marketing page
    workspace/  chat, video and upload
    providers/  Clerk and the auth token bridge
  hooks/        stateful logic
  lib/          formatting, timestamps, auth token
  services/     API client
  styles/       tokens.css (design tokens), motion.css, globals.css
  types/
```

## Design system

The visual language is defined in `../DESIGN.md`. Every colour, type role, radius and motion
value lives in `src/styles/tokens.css` as a Tailwind `@theme` token. Tailwind's default palette
is cleared, so a colour that is not a token does not compile. Do not hardcode values in components.

## Scripts

```bash
npm run dev     # development server
npm run lint    # ESLint
npm run build   # production build
npm start       # serve the production build
```

## Security headers

`next.config.ts` sets a Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options` and `Permissions-Policy`. The CSP allowlists the API origin, the Clerk
Frontend API (derived from the publishable key) and Cloudflare R2.
