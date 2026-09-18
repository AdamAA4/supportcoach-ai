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
- Current commit: `6840c8f`
- Generated: 2026-09-18T17:11:13.488Z
- Uncommitted files excluding this handoff: 

```text
M CHANGELOG.md
 M src/app/api/reference-import/extract-faq.test.ts
 M src/app/api/reference-import/extract-faq.ts
 M src/app/call/page.tsx
 M src/components/reference-panel.tsx
 M src/domain/derived-scenarios.test.ts
 M src/domain/derived-scenarios.ts
?? .impeccable/review/banner-element.png
?? .impeccable/review/mobile-empty-call-banner.png
?? .impeccable/review/mobile-setup-suggestions.png
?? .impeccable/review/mobile-sheet-expand.png
?? src/components/expandable-text.tsx
```
<!-- GENERATED SNAPSHOT: END -->
## Work completed in this handoff

Full UI redesign of the home, source setup, practice call, and coaching report screens. Final world: "Maison Rose," ported from the product lead's cosmet project (Downloads/cosmet) and pinned by the product lead on 2026-09-17 — blush canvas (#fbf3f0), white cards with rose-tinted shadows, plum ink, single rose accent (#b0586a), Fraunces + DM Sans via `next/font`, cream session sheet reserved for confirmed source. An earlier same-day "Rehearsal Studio" dark direction, plus a brightening pass on it, was replaced by this user-pinned direction before shipping; the home page's "or typed fallback" clause was also removed with approval. Styling-only: no product flow, voice-agent, evaluation, API, or storage changes.

Follow-up round 2 (same day, product-lead feedback): the source-channel segmented control's selected state was made clearly visible (white pill with soft shadow on the cream track — the Maison Rose port had collapsed it into the track background), and the oversized-page import error now names the recovery ("This page is larger than 200 KB. Copy the FAQ or policy text and paste it instead."). The 200 KB import cap itself is an approved control and stays.

- New world recorded in DESIGN.md; product truth in PRODUCT.md; direction brief and review evidence under `.impeccable/`.
- `src/app/globals.css`: Tailwind v4 `@theme` Maison Rose tokens (blush/white/plum/rose/tape palette, status banners, rose-tinted shadows, Cosmet radii), themed browser surfaces (selection, caret, scrollbars, focus), reduced-motion support.
- `src/app/layout.tsx`: Fraunces + DM Sans via `next/font` (no new dependency).
- New `src/components/ui.tsx` (pill button/input/lamp/authored-SVG primitives) and `src/app/icon.svg` favicon.
- Pages and components rebuilt in the world: console island with signal lamps and pinned status strings, timecoded transcript tracks with live REC, cream session-sheet reference panel, score cards with Fraunces numerals and rose segment meters, segmented source control, scenario cards.

Follow-up round (same day, product-lead feedback): the palette was brightened (canvas #211d1a → #322c26, lighter panels/lines/signal colors, same world and AA contrast), the home page's "or typed fallback" clause was removed with approval so copy matches the voice-only rule, and the mobile headline scale was tuned for 320px viewports. DESIGN.md and review screenshots re-captured to match.

Follow-up round 3 (2026-09-18, product-lead request): the import body cap was raised from 200 KB to 2 MB so heavy real-world FAQ pages import cleanly, and the oversized-page rejection now reports the measured page size with the recovery step ("This page is 4.6 MB, over the 2 MB import limit. Open the page, copy the FAQ or policy text, and paste it instead."). The extracted-text cap (200 KB), five-second deadline, SSRF protections, and test-pinned behavior are unchanged. A user-proposed "accept oversized imports" consent flow was discussed and declined: the endpoint is unauthenticated, so client-side consent cannot be enforced server-side and an absolute cap must exist regardless.

## Checks run

- `npm run lint`: no ESLint warnings or errors.
- `npm run typecheck`: clean.
- `npm test`: 14 files, 187/187 passed (after fixing a details/summary nesting regression the redesign introduced).
- `npm run build`: succeeded, all routes prerendered.
- `impeccable detect --json` over all changed UI files: zero findings.
- Impeccable finish review (fresh subagent): first verdict `fix`; after placeholder/danger contrast token fixes, live-state captures (mock voice mode, fake mic), DESIGN.md, and provenance, the verdict pass resolved every item; the final documentation amendment (console-composition deviation recorded in the brief and CHANGELOG) flipped it to ship.
- Visual evidence: `.impeccable/review/*.png` (desktop 1440x900, mobile 390x844 at 2x) with `provenance.json`; capture scripts preserved at `.impeccable/review/scripts/`.

Follow-up round 4 (2026-09-18, product-lead feedback): imported pages now preserve paragraph structure — the HTML cleaner converts block-level tags to line breaks before extraction, so imports produce per-section reference facts instead of one page-length blob (the root cause of factual accuracy scoring 0 on imports). Next exercise quotes at most 180 characters of the missed-fact answer, and the report clamps the display with a Show-full toggle. Back navigation added (Home on setup/report, Source setup on the call screen), and the session-sheet facts list collapses to three entries with a Show-all toggle.

Follow-up round 5 (2026-09-18, product-lead feedback): the fact matcher's evidence windows no longer start in front of a fact's own subject when a sibling fact uses the same word as a relation (for example "delivery" shared across delivery facts). A trainee answer that states a confirmed fact verbatim is now credited instead of missed; regression test added. Structured FAQ extraction also landed this round (JSON-LD, details/summary, definition lists, heading sections, duplicate removal) with import stats, and a grounded customer question plan now drives both voice modes.

Follow-up round 8 (2026-09-18, product-lead decisions): built-in drills removed from the setup screen — scenarios are now always derived from the confirmed source's own sections; a confirmed source with no complete FAQ sections gets the scenario error "This source has no complete FAQ sections to practice yet. Add a question with a full answer and try again." (validation gating; unresolved ids now build an honest empty-facts placeholder in createScenarioDefinition instead of silently falling back to a legacy archetype). Legacy late-delivery/refund-eligibility ids remain valid in validators so previously saved sessions restore. Bug fix from product-lead video: selecting a drill no longer calls invalidateSetup — clicking a suggested drill after confirming an imported link used to reset the source to unconfirmed, dropping its snapshot, wiping facts, and making every suggestion disappear. Verified in-browser: after confirm + drill click, "Source confirmed" persists and all 4 suggestions remain; built-in drills absent; the derived scenario carries into the call.

Follow-up round 8 (2026-09-18, product-lead feedback on deployed build): banner heading sections now split into per-question pairs when their content contains question-like paragraphs (fixes "one giant Frequently Asked Questions fact" on imported pages); "Subscribe to our newsletter" and similar newsletter headings added to the non-topic gate; long fact answers in the session sheet clamp with a Show more / Show less toggle (new ExpandableText primitive); the empty-call message is readable (light-red bg + dark-red ink, was dark-on-dark) and reads "No answers were recorded in this call, so there is nothing to score. Start a new practice call and answer the customer before ending." Verified in-browser: 5 suggestions from the equityedge-style FAQ, expand/collapse works, banner captured in .impeccable/review/banner-element.png.

Follow-up round 7 (2026-09-18, product-lead approved design): FAQ-derived practice scenarios. Substantive FAQ sections each become a suggested drill under a "From your FAQ" group in the setup picker (persona, natural opening line, the section's facts; related sections group when headings share two-plus significant words; thin/placeholder/contact sections never suggested; capped at six; deterministic content-hashed `derived-*` ids). The two built-in drills remain below as fallbacks. Contract widened: `PracticeScenario` now accepts `derived-*` ids (practice-pack `isSupportedScenarioId`, seed-packs `createScenarioDefinition(string)`, domain + evaluation validators), and the form auto-selects the first suggestion when the source changes. The fact matcher now pools required-term coverage across a fact's own comma-separated clauses within one statement (questions/ambiguity/conflicts never pool), so multi-clause verbatim answers score; regression tests added in derived-scenarios.test.ts and structured-fact-matcher.test.ts.

Follow-up round 6 (2026-09-18, product-lead 20-item launch checklist): privacy policy and terms pages, custom 404, site footer with CTA, per-page metadata with OG/Twitter cards and a generated 1200x630 social preview (public/og-image.png, 75KB), sitemap.xml + robots.txt (api/call/report disallowed), HSTS and hardening headers in the new next.config.mjs, per-IP fixed-window rate limits on reference-import (10/min) and voice-token (30/min) with 429 + Retry-After (bypassed under vitest; limiter unit-tested in src/lib/rate-limit.test.ts), a dismissible storage-disclosure notice (the site sets no cookies), and cookieless Vercel Analytics (@vercel/analytics 1.6.1 — installed with --legacy-peer-deps because its optional Svelte peer chain conflicts with the project's vite 7; @testing-library/dom was reinstalled explicitly afterward). Audits: 16 internal link references with zero broken, 18 WCAG contrast pairs all >= 4.5:1, page-load metrics TTFB 7-56ms / FCP 124-432ms / HTML 4-5KB against the production build; secrets confirmed server-only (empty .env.example, key never client-shipped); no <img> elements exist so alt-text is N/A; favicon already shipped as app/icon.svg. Items already satisfied before this round: secrets off frontend, form validation, mobile-first layout, favicon, image compression (only the OG image ships, already small).

## Remaining work or known issues

- Live AssemblyAI path was verified in mock voice mode only (joined call, lamps, REC); a smoke test with a real `ASSEMBLYAI_API_KEY` on a physical Android Chrome device is the recommended next check.
- Imported pages that render their FAQ client-side (JavaScript-only accordions) still cannot be read by the server-side importer; pasting the text remains the recovery. The deterministic matcher also stays conservative on paraphrases.
- The native file-input label ("Choose File") is unthemed browser copy, accepted in the finish review; revisit if it bothers anyone.
- The Mimosa pre-commit hook reported a partial scan (dependency-source and callgraph limits) on recent commits; re-run a full security audit when convenient.

## Instructions for the next agent

- Approved scope was the UI redesign plus the product lead's follow-up fixes (navigation, extraction structure, next-exercise clamp, import cap); beyond that, behavior, routes, API contracts, and environment-variable handling must stay as they are.
- Preserve the voice-only practice flow (no typed-response practice), the FAQ/notes grounding flow, server-only API secrets, and all test-pinned strings in `src/components/call-console.test.tsx` (including "Microphone: On — speak naturally") and `src/components/coaching-report.test.tsx`.
- Follow DESIGN.md for any future UI work: the Maison Rose world (blush/white/plum/rose), cream session sheet only for confirmed source material, Fraunces for display, one rose accent, no kickers above headings, no fake data visuals.
- Run `npm run handoff` before handing back, and commit completed work with its handoff together.
