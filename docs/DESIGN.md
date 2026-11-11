# Design system

> Navy ink on cool marble.

A quiet, confident study workspace: a near-white canvas with generous room, crisp white cards floating on cool stone-grey, and every piece of text in deep navy rather than black. One vivid blue carries every primary action. Soft magenta and cyan blobs sit behind product visuals for warmth, never as UI. Components stay restrained: 1px hairline borders, blue-tinted shadows, 24px panel radii and 8px buttons.

The tokens live in `client/src/styles/tokens.css` and nowhere else. Tailwind's default palette, radii, shadows and type scale are cleared, so an off-system value fails to compile.

---

## Colour

| Token | Value | Role |
|---|---|---|
| `ink-navy` | `#0b3558` | All text, headings, icons, dark buttons, inverse sections |
| `signal-blue` | `#006bff` | Filled primary actions, inline links, selection, focus ring |
| `slate-gray` | `#476788` | Secondary copy, helper text, muted labels |
| `mist-gray` | `#a6bbd1` | Disabled text, icons and secondary text on navy |
| `cloud` | `#f8f9fb` | Page canvas, footer |
| `paper` | `#ffffff` | Cards, panels, text on dark fills |
| `pebble` | `#f0f3f8` | Inputs, hover washes, subtle dividers |
| `hairline` | `#d4e0ed` | Card and input borders |
| `blue-wash` | `#e6f0ff` | Badges, selected rows, highlights |
| `deep-cobalt` | `#004eba` | Badge text, section eyebrows (informational, never an action) |
| `coral-magenta` | `#e55cff` | Decorative blob only |
| `sky-cyan` | `#0099ff` | Decorative blob only |

**Product extensions** (the marketing palette has no states or categories):

| Token | Value | Role |
|---|---|---|
| `signal-blue-hover` | `#0058d1` | Hover and pressed step of the primary blue |
| `danger` / `danger-wash` | `#c0262d` / `#fdecee` | Errors and destructive actions |
| `success` / `success-wash` | `#0f7b4a` / `#e3f5ec` | Completed steps, confirmations |
| `tile-*` | blue, navy, teal, purple, green, red | Subject tiles; each holds 4.5:1 under white |

Rules:
- Text is never `#000`. Navy for primary, slate for secondary.
- Signal Blue is the only filled primary action. Navy is the secondary filled action; keep the two apart.
- Magenta and cyan are atmosphere. They never fill a control or carry meaning.
- No background gradients. Surfaces are flat; elevation comes from shadow.

## Type

One family: **Manrope** (standing in for Gilroy), loaded with `next/font`. Hierarchy comes from size and weight; letter spacing stays normal. Timecodes and counts use `tabular-nums`.

| Token | Size / line height / weight | Use |
|---|---|---|
| `text-caption` | 12 / 1.5 / 400 | Meta, timestamps, helper text |
| `text-caption-strong` | 12 / 1.5 / 600 | Eyebrows and footer headings (uppercase, `tracking-wide`) |
| `text-label` | 14 / 1.4 / 500 | Card titles, inline labels, nav links |
| `text-body-sm` | 14 / 1.5 / 400 | Dense body copy |
| `text-body` | 16 / 1.5 / 400 | Body copy |
| `text-body-strong` | 16 / 1.5 / 600 | Emphasis in body |
| `text-button-sm` | 14 / 1.4 / 600 | Compact buttons |
| `text-button` | 18 / 1.6 / 600 | Standard buttons |
| `text-title-sm` | 18 / 1.4 / 600 | Panel and list headings |
| `text-body-lg` | 20 / 1.4 / 400 | Intros, hero copy |
| `text-title` | 24 / 1.4 / 600 | Card headings, step titles |
| `text-subheading` | 28 / 1.4 / 600 | Sub-section heads |
| `text-heading-sm` | 38 / 1.21 / 700 | H2 minimum; page titles |
| `text-heading` | 50 / 1.2 / 700 | Section headings |
| `text-heading-lg` | 68 / 1.2 / 700 | Hero on tablets |
| `text-display` | 80 / 1.2 / 700 | Hero on desktop |

Body roles use 1.5 leading rather than the reference's 1.0, which only suits one-line labels; `leading-none` covers those. On marketing and policy pages H2 never drops below 38px. Inside the workspace, where panels are narrow, headings use the title roles instead.

## Shape, space and elevation

| Radius | Value | Use |
|---|---|---|
| `rounded-md` | 4px | Small chips, focus outlines on inline items |
| `rounded-lg` | 8px | Buttons, inputs, list rows |
| `rounded-2xl` | 16px | Product cards, the player |
| `rounded-3xl` | 24px | Panels (the `panel` utility), dialogs, the closing band |
| `rounded-full` | pill | Badges, step numbers |

Buttons stay at 8px: sharper reads harsh, pill reads soft.

Spacing runs on an 8px base. The page is 1200px wide (`page` utility, 16px gutter, 24px from small screens). Sections step 48 → 64 → 96px (`section-y`). Cards pad 24px; elements sit 8–16px apart.

Shadows are blue-tinted, never neutral black:

| Token | Use |
|---|---|
| `shadow-link` | Panels and link cards |
| `shadow-button` | Filled buttons on hover |
| `shadow-elevated` | Product cards, dialogs, the consent banner |

## Components

All in `client/src/components/ui` unless noted. Reuse them; don't restyle locally.

- **Button** (`buttonClasses` is shared by `Button` and `ButtonLink`): `primary` Signal Blue, `dark` Ink Navy, `secondary` white with hairline border, `tertiary` text only. Sizes `md` (18px, 48px tall) and `sm` (14px, 36px tall).
- **TextLink** (`TEXT_LINK`): inline link in running text. Signal Blue, always underlined.
- **Card**: a `panel`. White, hairline, 24px radius, `shadow-link`.
- **Badge**: blue-wash pill with Deep Cobalt text. Informational only.
- **Input** (`FIELD` is shared with native selects): Pebble fill, hairline edge, white with a blue border on focus.
- **Alert**: tinted callout (info, success, danger). Errors use `role="alert"`.
- **Dialog**: native `<dialog>`, 24px radius, navy backdrop at 40%.
- **Wordmark**: navy tile with a blue playhead on a mist timeline, beside the name.

Site shell (`components/site`):
- **SiteHeader**: 64px sticky bar. Wordmark left, menu centred (hidden in the workspace), actions right. The marketing action is a dark "Get started".
- **SiteFooter**: column links on the canvas, slate uppercase headings, navy links. Columns come from `lib/navigation.ts`; policy links from `lib/legal.ts`.
- **PageShell / ArticleShell**: header, main and footer; `ArticleShell` puts reading pages in one white panel.

Landing (`components/landing`), with all copy in `content.ts`:
- **Hero**: two columns. Badge, display headline, body-lg copy and two actions on the left; the answer card on its blobs on the right.
- **ProductStage / ProductCard**: the blob backdrop and the 16px white card in front of it.
- **TrustStrip**: plain names of recording sources, centred on the canvas.
- **SectionHeader**: eyebrow, heading, intro; centred or left-aligned.
- **FeatureBlock**: text and accordion on one side, a product visual on the other, alternating sides.
- **FeatureList**: accordion. The open item is navy with a blue icon; closed items are slate.
- **ClosingCta**: navy inverse band with one primary action.

## Accessibility

- Every text pairing meets WCAG AA (4.5:1); focus rings and control edges meet 3:1.
- Two adjustments to the reference follow from that. Signal Blue text on the canvas is about 4.4:1, so small blue labels (eyebrows) use Deep Cobalt instead. Mist Gray text on light surfaces is about 1.9:1, so mist is kept for disabled states and for text on navy; closed accordion items and the trust strip use slate.
- Focus is a solid 2px Signal Blue outline everywhere, white on navy (`focus-on-dark`).
- Motion is limited to short rises, pulses and colour transitions, and switches off under `prefers-reduced-motion`.
- Playwright runs axe on every public page, the workspace and the 404, at desktop and phone sizes (`client/e2e/site.spec.ts`).

## Imagery

Product visuals only: clean UI cards on white with generous radii, each backed by a soft magenta or cyan blob offset behind it. No photography. Icons come from Phosphor in the regular (line) weight, mono-tone, coloured by the text they sit in (`components/ui/icons.tsx`).
