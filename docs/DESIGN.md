# Design specification

The visual and interaction rules for the client. The source of truth for every value is `client/src/styles/tokens.css`, a Tailwind `@theme` block. The default Tailwind palette, radii, shadows, type scale and easings are cleared there, so a value that is not a token fails to compile. Never hardcode a colour, size or duration in a component.

## Principles

1. **One accent.** Cobalt `#2346c8` marks the primary action, links, focus and the lit moment in the logo. Nothing else competes with it.
2. **Flat and bordered.** Surfaces are separated by 1px borders, not shadows.
3. **Light theme only.** `color-scheme: light`. There is no dark mode.
4. **The desktop metaphor.** The app is a window on a muted olive wallpaper. Windows are the only elevated objects.
5. **Evidence first.** A cited timestamp is the product's proof, so citations, the timeline and the player get the most visual weight.
6. **Plain language.** Short sentences, no jargon, no filler.

## Typeface

Geist for text and Geist Mono for code, timestamps and tabular figures, both loaded through `next/font/google`. The stack is `var(--font-geist), -apple-system, system-ui, sans-serif`.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `primary` | `#2346c8` | Primary action, links, focus ring |
| `primary-pressed` | `#1b38a3` | Hover on primary |
| `primary-active` | `#152d85` | Pressed, and the edge under primary buttons |
| `on-primary` | `#ffffff` | Text on primary |
| `accent-on-dark` | `#8fa5f0` | Accent text and icons on dark surfaces |
| `accent-soft` | `#e1e7fa` | Info callouts, highlights, quotes |
| `canvas` | `#eef0ec` | Page background |
| `surface-card` | `#ffffff` | Cards, inputs |
| `surface-soft` | `#e4e8e3` | Skeletons, quiet fills |
| `surface-doc` | `#fafbf9` | Window body |
| `surface-dark` | `#1d2421` | Timeline strip, logo strip |
| `on-dark`, `mute-on-dark` | `#ffffff`, `#aeb7b1` | Text on dark surfaces |
| `hairline` | `#c3c9c3` | Card and divider borders |
| `hairline-soft` | `#dbdfdb` | Quiet dividers |
| `hairline-strong` | `#6a726c` | Control edges, 3:1 against the canvas |
| `ink` | `#1d2421` | Headings, primary text |
| `body` | `#454d48` | Body text |
| `mute-strong` | `#515955` | Secondary text, placeholders |
| `disabled` | `#8b938d` | Disabled controls |
| `success`, `success-soft` | `#1b7347`, `#d9eee2` | Success text and fill |
| `danger`, `danger-soft` | `#b3352d`, `#f8dedb` | Error text and fill |
| `focus`, `focus-on-dark` | `primary`, `accent-on-dark` | Focus rings |
| `wallpaper`, `wallpaper-deep` | `#c9d5b6`, `#b3c29c` | Desktop and its texture |
| `tile-blue` `#2346c8`, `tile-green` `#1b7347`, `tile-red` `#b3352d`, `tile-purple` `#7a3f9a`, `tile-teal` `#0e7078`, `tile-olive` `#5f6b2a` | | Subject tiles, each 4.5:1 or better under white |

## Type ladder

The sizes are 12, 13, 14, 16, 18, 21, 25, 30 and 36px. Each role carries its own weight, line height and tracking, so components never set those.

| Role | Size | Weight | Line height |
|---|---|---|---|
| `display-xl` | 36 | 700 | 1.15 |
| `display-lg` | 30 | 700 | 1.2 |
| `display-md` | 25 | 700 | 1.25 |
| `heading-lg` | 21 | 650 | 1.3 |
| `heading-sm` | 18 | 600 | 1.4 |
| `body-md`, `body-strong` | 16 | 400, 600 | 1.55 |
| `body-sm`, `body-sm-strong` | 14 | 400, 600 | 1.5 |
| `caption-sm` | 13 | 450 | 1.45 |
| `utility-xs` | 12 | 600, tracked 0.04em | 1.35 |
| `button-md`, `button-sm` | 14, 13 | 600 | 1.25 |
| `code-sm`, `code-xs` | 14, 13 | 500, 400 | 1.45 |

Body copy never runs wider than 65 characters (`measure`), short intros 52 (`measure-narrow`). Headings use `text-wrap: balance`.

## Shape, borders, shadow, spacing

- **Border:** 1px everywhere. Decorative edges use `hairline`; edges that identify a control use `hairline-strong`.
- **Radius:** `sm` 4px for inputs, chips and inline buttons. `md` 8px for cards and buttons. `xl` 16px for windows only. Pills and avatars use `rounded-full`.
- **Shadow:** one, `shadow-window`, for a window floating over the wallpaper and for the consent banner. Nothing else has a shadow.
- **Layout:** page column 80rem, with a 1rem gutter that becomes 1.5rem from 40rem. Section padding is 5rem, stepping to 4rem and 3rem on smaller screens. The sticky nav is 4rem and the only raised layer (`z-nav` 20, `z-banner` 30).
- **Card padding:** 24px standard, 20px for compact tiles.

## Motion

- One curve, `ease-brand` `cubic-bezier(0.16, 1, 0.3, 1)`, at three speeds: 150ms, 250ms, 400ms.
- Only `transform` and `opacity` animate.
- Every animation sits behind `prefers-reduced-motion: no-preference`, so the resting state is the fully visible one. Scroll reveals are armed only when the element is below the fold and motion is allowed, so nothing is hidden without JavaScript.
- Named animations: `rise` (entrance), `mark-in` (timeline markers), `pulse-dot` (loading), `hatch` (work in progress), `spin`.
- Drag, layout and exit animation use `motion`, loaded once through `LazyMotion`.

## Components

All in `client/src/components/ui/`.

| Component | Notes |
|---|---|
| `Button`, `ButtonLink` | Variants `primary`, `secondary`, `tertiary`; sizes `sm`, `md`. A face on a darker edge: hover lifts, press drops flush. |
| `IconButton` | 44px square on touch screens, 36px from the `sm` breakpoint. Needs an accessible label. |
| `Input` | 44px high on touch, 40px above. `hairline-strong` border, `danger` border in the error state. |
| `Card` | White, 1px `hairline` border, `md` radius. Padding `none`, `tile` or `standard`. |
| `Badge` | Outlined pill for status and mode labels. |
| `Alert` | Tones `success`, `info`, `danger`. Danger uses `role="alert"`, others `role="status"`. |
| `Dialog` | Native `<dialog>`: focus trap, Escape to close, inert page behind. |
| `ProgressBar` | Tones `primary`, `success`, `danger`; `busy` slides hatching across the fill. Always labelled. |
| `Skeleton`, `SkeletonLines` | Flat blocks at rest; announce what is loading. |
| `Wordmark` | Dark strip with one lit tick, beside the product name. |
| `icons` | Re-exports of Phosphor icons. Add new icons here, not inline. |

## Accessibility

- **Contrast:** 4.5:1 for text, 3:1 for borders, focus rings and other UI, checked for every pairing in the tokens file. The accent on the wallpaper is 4.0:1 at its lowest. Disabled controls are exempt.
- **Focus:** one treatment everywhere, a solid 2px outline in `focus` with a 2px offset on `:focus-visible`. On dark surfaces use `focus-on-dark`.
- **Touch targets:** interactive controls are at least 44px on touch screens. Taps use `touch-action: manipulation`.
- **Reduced motion:** see Motion. Skeletons rest as flat blocks.
- **Semantics:** native elements first (`dialog`, `button`, `a`). Icon-only controls and progress bars carry labels. The product name is marked `translate="no"` so machine translation leaves it alone.
- **Testing:** `npm run e2e` runs Playwright with axe at 1280px and 375px widths.

## Copy

- Sentence case for every heading, button, label and menu item. Proper nouns keep their capitals.
- No em dashes or en dashes. Use a period, comma, colon or hyphen.
- One label per intent. The same action is always called the same thing everywhere it appears: "Upload", "Delete", "Cancel", "Connect".
- State what happened and what to do next in errors: "That file is larger than the 4 GB limit." Do not blame the user and do not expose internals.
- Time is written `12:04` or `1:02:04`, in Geist Mono.
- No emoji.
