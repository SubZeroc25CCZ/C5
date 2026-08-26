---
name: subzero-design
description: SubZero's design system and UI/UX rules. Use this whenever you build, modify, restyle, or review ANY user-facing surface in this repo — pages, components, screens, dashboards, paywalls, empty states, emails rendered as UI, marketing sections, mockups — even when the request doesn't mention "design" (e.g. "add a page", "show X on the dashboard", "make a settings screen"). It tells you which tokens, components, and honesty rules every screen must follow so new UI looks and behaves like the rest of the product.
---

# SubZero UI/UX

Pair this with the generic `ui-ux-pro-max` skill (also in this repo): that one
supplies universal design intelligence (styles, palettes, typography, UX
guidelines, stack tips); THIS one is the product's law — where they disagree,
SubZero's tokens, components, and honesty rules win.

New UI extends the existing vocabulary; it never invents a parallel one. Before
writing any markup, read the three sources of truth:

- `src/app/globals.css` — the frost design tokens (light + dark via system theme)
- `src/components/ui.tsx` — the dependency-free component kit
- `SCREEN_PLAN.md` §0 — the design laws (and the screen you're building, if listed)

## Design laws (non-negotiable, from SCREEN_PLAN.md §0)

1. **Mobile-first.** Design at 375px, then widen. Flex/grid with `gap`, `flex-wrap`
   on rows, `sm:`/`lg:` breakpoints to add columns — never to fix overflow.
2. **Money is the hero.** The biggest element on a screen is a number the user
   cares about. Money always wears `tnum` (tabular numerals) and is formatted
   with `formatMinor` / the `money()` helper — never hand-rolled `$${x/100}`
   (that corrupts zero-decimal currencies like JPY; use `minorToMajor`/`majorToMinor`).
3. **Honesty (spec §10).** Only observed numbers. Per-currency totals side by
   side — never merged or FX-converted. "Cancelled" appears only when
   provider-confirmed. Unconfirmed recurrence never renders a cycle ("/month");
   it shows observed totals ("€38.94 observed · 3 charges"). Badges equal the
   evidence count. Aggregator storefronts (Apple, Google, PayPal, Amazon,
   Microsoft — see `src/lib/aggregators.ts`) render as "storefront charges"
   groups, never as a subscription with a monthly price.
4. **Four states per screen.** A screen isn't done without: loading (skeleton
   blocks — `animate-pulse rounded bg-surface-2` — not spinner-only), empty
   (`EmptyState` with the next action), error (plain words + a retry `Button`),
   and where relevant expired-permission (reconnect path). Copy the patterns in
   `src/app/dashboard/cancellations/cancellations-client.tsx`.
5. **Evidence on demand.** Any detected fact links to "what we saw" — receipts,
   dates, subjects. Never present derived data without a path to its evidence.
6. **Paywalls are server-enforced and never dark-patterned.** The teaser (D5)
   is redacted at the API layer; client lock screens are presentation only —
   never gate data client-side and call it locked. Locked UI states the price
   plainly and links `/pricing`; it never nags, fakes urgency, or hides the
   dismiss. Price strings in paywall copy must match `/pricing` exactly
   (currently Basic $4.99/mo · $49/yr, Pro $9.99/mo · $99/yr).

## Tokens and components

Use semantic token classes, never raw palette values: `bg`/`surface`/`surface-2`
for grounds, `ink`/`muted` for text, `line` for borders, `frost`/`frost-strong`/
`frost-soft`/`frost-ink` for the brand accent, `ok`/`warn`/`danger` (+ `-bg`)
for status. Tokens flip for dark mode automatically — a raw hex breaks that.
The one sanctioned exception: always-dark marketing surfaces (the landing hero
and privacy band) use the fixed navy set (`#0a1626`, `#101f36`, `#1c2c44`,
`#22b8d4`, `#a8b8ca`, `#64788f`) because they deliberately keep one look in
both themes.

Reach for the kit before writing new markup: `Button`/`LinkButton` (variants
primary · secondary · ghost · danger), `Card`, `Badge`/`StatusBadge` (honest
status labels live in `StatusBadge` — extend it, don't fork it), `Stat`,
`MerchantLogo`, `DifficultyMeter`, `EmptyState`, `ProgressBar`, `cx`. A new
reusable primitive belongs in `src/components/ui.tsx`, styled from tokens, with
a disabled state and a cursor-pointer, matching the kit's density (rounded-lg/
rounded-2xl, px-4 py-2 controls, text-sm default).

Shape conventions the product already uses: page shells are
`mx-auto max-w-6xl px-4` (max-w-3xl/4xl for reading pages), section cards are
`rounded-2xl border border-line bg-surface`, chips are rounded-full, icons are
inline stroke SVGs (`stroke="currentColor"`, `aria-hidden`) — no icon library,
no new dependencies for UI.

## Copy voice

Plain, honest, lightly warm. Say what the system actually did ("Request sent —
awaiting provider confirmation", "We found 8 receipts"), never what sounds
better ("Cancelled!", "seen once" over 8 receipts). Sentence case everywhere
except tiny uppercase tracking labels. Every claim about the free tier must
match the teaser exactly (totals + count + one unlocked subscription). When a
feature costs money, name the price; when we're unsure, say so on screen —
uncertainty is content, not something to hide.

## Before shipping any UI change

Run the repo's checks — `npx tsc --noEmit`, `npm run lint`, `npm test`, and
`npm run build` — and re-read the diff against the laws above, especially: does
any number claim a cycle it hasn't earned, does any total merge currencies, and
does every new screen carry its four states?
