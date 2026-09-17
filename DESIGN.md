# Design — SupportCoach AI

World: **Maison Rose**, ported from the product lead's `cosmet` project (Downloads/cosmet) on 2026-09-17. This replaces the previous "Rehearsal Studio" world by explicit user-pinned direction: "apply the current UI design of cosmet to this project." Mode: Operate. Single light theme (Cosmet's default); no dark variant is shipped.

## Tokens (src/app/globals.css, Tailwind v4 @theme)

- Ground: blush canvas `#fbf3f0`; cream inset/shell `#f8ece8`; white panels `#ffffff`; raised `#f8ece8`; hairlines `rgba(93,42,54,0.12)` / strong `rgba(93,42,54,0.26)`.
- Ink: plum `#3a2530` primary; `#5f4a53` soft; `#7d646b` muted (small meta); `#745f67` faint (placeholders/disabled only).
- Accent: rose `#b0586a` (hover/dark `#93424f`, bright `#d4919c`) with white ink on filled buttons; rose is the only accent and is used identically everywhere.
- Status: success `#3f7a50`, warning `#8f621c`, danger `#b03a31`; tinted banners danger `#f7e3e0`/`#93312a`, ok `#e9f0e6`/`#356843`, warn `#f5ead2`/`#7a5417`.
- Cream "session sheet" surface (`#f8ece8` ground, plum ink, dashed `rgba(93,42,54,0.16)` rules, white fact cards) is reserved for confirmed source material; confirmed stamp and status text use `#356843` / `#8f621c` on cream.
- Type: Fraunces (display headings, score numerals; extrabold, tracking-tight) + DM Sans (body/UI, 15px base). No monospace: numeric data uses `tabular-nums`.
- Radii: cards 1.375rem (`rounded-2xl`), inner cores/inputs 0.9rem (`rounded-xl`); pill buttons and status pills (`rounded-full`).
- Elevation: Cosmet's rose-tinted shadows only — `shadow-soft` / `shadow-card` (`--shadow-*` tokens). No rings as primary elevation; `border-line` for structure.

## Components

- Console island (double bezel): `bg-shell p-1.5 shadow-card` shell, inner `bg-panel rounded-xl`. Header row: cream source chip (plum ink) + status pill (lamp + capitalized state, tinted by state). Status rows keep pinned sentences with lamps. Transport: rose primary pill / white outline pill / danger outline pill.
- Transcript: white panel; timecodes right-aligned `tabular-nums`; speaker tags in letterspaced bold caps (Customer = warning gold, You = success green); hairline row separators; dashed empty state; red REC pulse when live.
- Session sheet: cream panel with 2px plum header rule, dashed key/value rows, white fact cards, rotated confirmed stamp.
- Buttons: pill, `active:scale-[0.97]`, 200ms `cubic-bezier(0.23,1,0.32,1)`, min-height 44px; primary rose with white ink.
- Inputs: white surface, rose caret + focus border, 16px text (no Android focus zoom); native file input with themed button.

## Motion

Cosmet's `fade-up` (0.4s, `cubic-bezier(0.16,1,0.3,1)`) for page/section entries with a 75ms stagger on report cards. Authored moment: signal lamps settle between states and the REC dot pulses (1.6s) while the call is live. `prefers-reduced-motion` collapses all motion to opacity-only.

## States and browser surfaces

Loading (pulsing dot + `role="status"`), connecting, live, muted, ended, error (danger banner naming problem + Retry), empty (transcript, report, notes). Themed per Cosmet: selection `#f3d3d9`/`#4a1f28`, rose caret, thin rose-line scrollbars, rose `:focus-visible` outline, `color-scheme: light`, `themeColor` `#fbf3f0`.

## Never

No kickers/eyebrows above headings; no fake data visuals (mic-level meter deliberately omitted — no real level data); no second accent color; no dark sections inside the light theme; no em-dashes in new copy (the test-pinned legacy string "On — speak naturally" is retained product copy); don't reintroduce monospace fonts.
