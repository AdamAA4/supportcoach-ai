# Design — SupportCoach AI

World: **Rehearsal Studio** (locked by the product lead 2026-09-17 from a three-option round; seed key b5cadc6f). A practice call is a studio session tape: warm charcoal ground, cream ink, amber transport, signal lamps for live state, and exactly one cream "session sheet" surface reserved for confirmed source material. Mode: Operate.

## Tokens (src/app/globals.css, Tailwind v4 @theme)

- Ground (brightened 2026-09-17 on product-lead feedback): canvas `#322c26`; inset shell `#2a251f`; panels `#3a342c` / raised `#464034`; hairlines `#574e43` / `#6e6355`.
- Ink: `#f2ead8` primary, `#d6cab3` soft, `#b8ab93` muted (small meta), `#9d9078` faint (placeholders/disabled only).
- Primary: amber `#f0ae4a` (hover `#f6bd62`) with ink `#241c10`; success `#85b872`; warn `#e3ab55`; danger `#e8896f`.
- Session sheet (cream, confirmed source only): `#efe6d0` ground, `#2b241c` ink, `#6b5f4c` muted, `#c9bda2` rules; fact cards `#f6efe0`; confirmed stamp `#3d6b4a`.
- Tinted banners: danger `#46302a`/`#f4b3a2`, ok `#32402f`/`#b1d49f`, warn `#463b26`/`#e8c987`.
- Type: Bricolage Grotesque (display + UI; bold headings, tracking floor -0.025em) + Geist Mono strictly for measured data (timecodes, hashes, scores, status pills, stamps) with `tabular-nums`.
- Radii: panels 16px (`rounded-2xl`), inner cores/inputs/buttons 12px/10px (`rounded-xl`/`rounded-lg`); badges square-ish (`rounded-md`). Elevation: 1px ring only (`ring-1 ring-line`); no drop shadows; the `lamp-live` glow is a state signal, not depth.

## Components

- Console island (double bezel): `bg-shell p-1.5 ring-1 ring-line` shell, inner `bg-panel rounded-xl`. Header row: cream source chip + status pill (lamp + capitalized state). Status rows keep pinned sentences with lamps. Transport: amber primary / outline secondary / danger outline.
- Transcript ("tracks"): mono timecode column, mono uppercase speaker tag (Customer = warn amber, You = ok green), cream body text; hairline row separators; dashed empty state; red `REC` pulse when live.
- Session sheet: cream panel with 2px ink header rule, mono key/value dashed rows, fact cards; the only light surface in the world.
- Buttons: `active:scale-[0.97]`, 150ms `cubic-bezier(0.23,1,0.32,1)`; min-height 44px.
- Inputs: `bg-shell`, amber caret + focus border, 16px text (no Android focus zoom).

## Motion

One authored moment: signal lamps settle between states (200ms) with a live glow, and the REC dot pulses (1.6s). Report cards settle in with a 75ms stagger (240ms). Everything else is hover/press feedback. `prefers-reduced-motion` collapses all of it.

## States and browser surfaces

Loading (pulsing warn dot + `role="status"`), connecting, live, muted, ended, error (danger banner naming problem + Retry), empty (transcript, report, notes). Themed: amber selection + caret, thin `line-strong` scrollbars, cream `:focus-visible` outline, `color-scheme: dark`, `themeColor` `#211d1a`.

## Never

No kickers/eyebrows above headings; no fake data visuals (a mic level meter was deliberately omitted — no real level data exists); mono never as costume; no second light surface besides the session sheet; no em-dashes in new copy (the test-pinned legacy string "On — speak naturally" is retained product copy).
