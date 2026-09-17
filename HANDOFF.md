# SupportCoach AI handoff

The outgoing coding model completes this file before moving to another tool. Run `npm run handoff` first; it refreshes the Git snapshot below and preserves the model-written notes that follow it.

## Rules for the next agent

- Read this file, `README.md`, `CHANGELOG.md`, `ENHANCEMENTS.md`, and `BUGS.md` before editing.
- Preserve the voice-only trainee experience, the FAQ-and-notes grounding flow, and server-only API secrets.
- Do not reset, stash, revert, or delete another agent's work. Do not commit unrelated work.
- Before handing back, the outgoing model must run `npm run handoff`, write the sections below from its completed work and check results, then commit and push the completed, approved work and its handoff together. The product lead does not fill these sections manually.

<!-- GENERATED SNAPSHOT: START -->
## Current Git snapshot

- Branch: `supportcoach-mvp`
- Current commit: `40572b7`
- Generated: 2026-09-17T22:20:20.473Z
- Uncommitted files excluding this handoff: 

```text
M .impeccable/review/desktop-call-live.png
 M .impeccable/review/desktop-call.png
 M .impeccable/review/desktop-home.png
 M .impeccable/review/desktop-report.png
 M .impeccable/review/desktop-setup.png
 M .impeccable/review/mobile-call-live.png
 M .impeccable/review/mobile-call.png
 M .impeccable/review/mobile-home.png
 M .impeccable/review/mobile-report.png
 M .impeccable/review/mobile-setup.png
 M BUGS.md
 M CHANGELOG.md
 M DESIGN.md
 M src/app/globals.css
 M src/app/icon.svg
 M src/app/layout.tsx
 M src/app/page.tsx
```
<!-- GENERATED SNAPSHOT: END -->
## Work completed in this handoff

Full UI redesign of the home, source setup, practice call, and coaching report screens in the "Rehearsal Studio" visual direction, chosen by the product lead on 2026-09-17 from three presented options (emil-design-eng, design-taste-frontend, and impeccable skills; decision tool used). Styling-only: no product flow, voice-agent, evaluation, API, or storage changes.

- New world recorded in DESIGN.md; product truth in PRODUCT.md; direction brief and review evidence under `.impeccable/`.
- `src/app/globals.css`: Tailwind v4 `@theme` studio tokens (charcoal/cream/amber/tape palette, lamps, banners), themed browser surfaces (selection, caret, scrollbars, focus), reduced-motion support.
- `src/app/layout.tsx`: Bricolage Grotesque + Geist Mono via `next/font` (no new dependency).
- New `src/components/ui.tsx` (button/input/lamp/authored-SVG primitives) and `src/app/icon.svg` favicon.
- Pages and components rebuilt in the world: console island with signal lamps and pinned status strings, timecoded transcript tracks with live REC, cream session-sheet reference panel, score cards with mono numerals and segment meters, segmented source control, scenario cards.

Follow-up round (same day, product-lead feedback): the palette was brightened (canvas #211d1a → #322c26, lighter panels/lines/signal colors, same world and AA contrast), the home page's "or typed fallback" clause was removed with approval so copy matches the voice-only rule, and the mobile headline scale was tuned for 320px viewports. DESIGN.md and review screenshots re-captured to match.

## Checks run

- `npm run lint`: no ESLint warnings or errors.
- `npm run typecheck`: clean.
- `npm test`: 14 files, 187/187 passed (after fixing a details/summary nesting regression the redesign introduced).
- `npm run build`: succeeded, all routes prerendered.
- `impeccable detect --json` over all changed UI files: zero findings.
- Impeccable finish review (fresh subagent): first verdict `fix`; after placeholder/danger contrast token fixes, live-state captures (mock voice mode, fake mic), DESIGN.md, and provenance, the verdict pass resolved every item; the final documentation amendment (console-composition deviation recorded in the brief and CHANGELOG) flipped it to ship.
- Visual evidence: `.impeccable/review/*.png` (desktop 1440x900, mobile 390x844 at 2x) with `provenance.json`; capture scripts preserved at `.impeccable/review/scripts/`.

## Remaining work or known issues

- Live AssemblyAI path was verified in mock voice mode only (joined call, lamps, REC); a smoke test with a real `ASSEMBLYAI_API_KEY` on a physical Android Chrome device is the recommended next check.
- The native file-input label ("Choose File") is unthemed browser copy, accepted in the finish review; revisit if it bothers anyone.
- The seeded report screenshot shows factual accuracy 0 with matching answers: that is the deterministic evaluator's documented paraphrase limitation, not a UI defect.
- The Mimosa pre-commit hook reported a partial scan (dependency-source and callgraph limits) on the redesign commit; re-run a full security audit when convenient.

## Instructions for the next agent

- Approved scope was UI redesign only; behavior, routes, API contracts, and environment-variable handling are unchanged and must stay that way.
- Preserve the voice-only practice flow (no typed-response practice), the FAQ/notes grounding flow, server-only API secrets, and all test-pinned strings in `src/components/call-console.test.tsx` (including "Microphone: On — speak naturally") and `src/components/coaching-report.test.tsx`.
- Follow DESIGN.md for any future UI work: charcoal/cream/amber world, cream session sheet only for confirmed source material, mono only for measured data, no kickers above headings, no fake data visuals.
- Run `npm run handoff` before handing back, and commit completed work with its handoff together.
