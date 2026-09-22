# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- App logo: voice-bar mark in a plum rounded tile with a Fraunces wordmark ("SupportCoach" in ink, "AI" in rose), as a reusable component (`src/components/logo.tsx`) plus a standalone `public/logo.svg` asset; used in the home header (linking home) and the site footer.
- FAQ-derived practice scenarios: after a source is confirmed, substantive FAQ sections each become a suggested drill (persona, natural customer opening line, and the section's confirmed facts, with related sections grouped when their headings share significant words). The setup screen shows them under a "From your FAQ" group; picking one grounds the customer's questions and factual scoring in that section. Thin sections, placeholder headings, and site furniture are never suggested, suggestions are capped at six, and ids are content-derived so stored sessions rebuild deterministically.
- Fact matcher: required terms may now be covered across the fact's own comma-separated clauses within one statement (windows anchored on the fact's relation words pool their tokens), so multi-clause answers like "To register as an affiliate, submit the form..." are credited verbatim; questions, ambiguity, and conflicts still never pool.

### Changed

- Voice practice can now combine multiple selected FAQ-derived scenarios into one session. The combined scenario retains every selected fact for the customer question plan and factual scoring, then saves one deterministic coaching report; existing single-scenario sessions remain compatible.
- Multi-page FAQ import: FAQ hub pages that only list their content (like equityedge.io/faq, whose five sections each link to several article pages) are now followed with a bounded, visible, same-origin read. The importer discovers same-origin links inside the hub's own path (never external hosts or other site areas), caps at 8 pages with a 12-second shared deadline, applies the existing SSRF/public-IP validation and no-redirect rules to every discovered URL, deduplicates by path, and merges each page's Q/A pairs into the confirmed source. The setup screen reports pages read and lists any that were skipped as unreachable. Pasted FAQ text remains the fallback for JavaScript-only or inaccessible pages.
- The setup form's "Company name" field is now "Session name" (validation message updated to match); stored field names are unchanged.
- Built-in drills removed from the setup screen (product-lead decision): they could mismatch arbitrary imported FAQs. Practice scenarios are now always derived from the confirmed source's own sections; a confirmed source with no complete FAQ sections gets a clear "add a question with a full answer" error instead of starting an unrelated drill. The legacy ids remain valid only so previously saved sessions still restore.
- Selecting a practice drill no longer invalidates the confirmed source. This fixes the reported bug where clicking a suggested drill after confirming an imported link reset the source to unconfirmed — which dropped its snapshot, wiped the extracted facts, and made every suggestion disappear.
- FAQ-import URL field uses type="url" with a URL keyboard on mobile; server-side validation is unchanged.
- Launch-hardening round (2026-09-18, product-lead checklist): privacy policy and terms of use pages, a custom 404 page with calls to action, a site footer with navigation and a persistent "Set up a practice call" CTA, sitemap.xml and robots.txt (API, call, and report excluded from crawling), per-page meta titles and descriptions with Open Graph and Twitter card metadata plus a generated 1200x630 social preview image, a dismissible storage-disclosure notice (the site sets no cookies and runs no cross-site tracking), cookieless Vercel Analytics, Strict-Transport-Security and hardening headers via next.config.mjs, and per-IP rate limiting on the public reference-import (10/min) and voice-token (30/min) endpoints with unit-tested fixed-window limiter and 429 responses.
- Site-launch audits recorded in `.impeccable/review/`: internal link check (16 references, zero broken), WCAG contrast audit (18 token pairs, all >= 4.5:1), and page-load metrics against the production build (TTFB 7-56ms, first contentful paint 124-432ms, HTML 4-5KB).

### Added

- Product and design records: PRODUCT.md (product truth), DESIGN.md (Rehearsal Studio design system), and `.impeccable/` direction brief and review evidence (screenshots with provenance) from the 2026-09-17 design round.
- Shared visual primitives module (`src/components/ui.tsx`) with studio button, input, signal-lamp, and authored SVG icon styles used across all screens.
- Branded app icon (amber voice-bar mark on charcoal) served as the site favicon.
- Model-owned `HANDOFF.md` protocol and `npm run handoff` command for safe transitions between coding tools.

- Vercel production deployment at https://supportcoach-ai-ten.vercel.app with live voice configuration stored for Production and Preview.
- Deterministic coaching evaluation with four explained scores, confirmed-source fact checks, two strengths, missed facts, unsupported claims, one next exercise, and the exact completed transcript.
- Validated evaluation endpoint with source-hash/fact consistency checks, imported snapshot verification, transcript limits, and stable error responses.
- Report page with expandable transcript, practice-again and clear-data actions, and versioned completed-practice persistence that restores after refresh.
- Call-end evaluation with a frozen transcript, retryable failures, response validation, and saving only after successful evaluation.
- Live AssemblyAI voice-agent transport with server-minted temporary tokens, browser microphone streaming, customer-audio playback events, interruption cleanup, and mock/live mode selection.
- One-time public HTTPS FAQ/policy importer with private-network rejection, a five-second deadline, 200 KB cap, sanitized readable snapshots, canonical URLs, and SHA-256 provenance hashes.
- Health endpoint for deployment readiness checks.
- Reusable voice-agent transport contract, browser audio player, and mock simulated-customer adapter with Web Speech recognition and typed fallback.
- Confirmed-session call route with an explicit call-state machine, live transcript, reference panel, microphone/audio status, retry handling, and Playwright-safe mock customer turn control.
- Initial per-session practice-pack domain contract and product-input decision record.
- Next.js App Router and Tailwind scaffold with lint, typecheck, unit-test, build, and CI gates.
- Normalized source facts, scenario definitions, transcript/report contracts, and validation for grounded practice sessions.
- Source setup screen that requires FAQ/policy preview confirmation before a trainee can start a simulated customer call.

### Changed

- Full visual redesign of the home, source setup, practice call, and coaching report screens in the "Maison Rose" visual direction, ported from the product lead's cosmet project and pinned by the product lead on 2026-09-17 after a three-option design round: blush canvas (#fbf3f0), white cards with rose-tinted soft shadows, plum ink, a single rose accent, and a cream session-sheet surface reserved for confirmed source material.
- Typography via bundled `next/font` fonts (no new dependency): Fraunces for display headings and score numerals, DM Sans for UI and body, with tabular numerals on numeric data.
- Practice call screen rebuilt as a double-bezel console island: cream source chip, live signal lamps for call/microphone/customer-audio states (pulsing when live), rose transport buttons, and a timecoded transcript track list with a red REC pulse while the call is live; the session reference renders as the sticky cream sheet.
- Coaching report rebuilt as coaching records: Fraunces serif score numerals with three-segment rose meters, staggered card entrances, warm next-exercise panel, and a chevron transcript disclosure.
- Source setup form restyled with a segmented paste/link channel control, selectable scenario cards with rose lamp markers, the cream extracted-source sheet with CONFIRMED stamp styling, and themed inputs, file input, and selects at 16px (no Android focus zoom).
- Back navigation added to the setup, call, and report screens (Home on setup and report; Source setup on the call screen).
- Session reference facts list is collapsed by default to three entries with a "Show all facts" toggle and a fact count.
- Import body cap raised from 200 KB to 2 MB (product lead request): pages up to 2 MB now import cleanly, and oversized pages are rejected with their measured size and the recovery step. The extracted-text cap (200 KB) is unchanged.
- Favicon updated to the app logo identity: plum rounded tile with rose voice bars (was the earlier amber-on-charcoal mark), matching `public/logo.svg` and the header/footer logo components.
- Structured FAQ extraction on import: FAQPage JSON-LD, details/summary accordions, definition lists (dt/dd), and heading-plus-content sections are extracted as question/answer pairs; exact duplicates are removed by normalized question plus answer while the same answer under a different question is retained. The import response now reports page bytes, extracted characters, pair count, and whether question/answer structure was detected, and the setup screen shows how much was imported and flags pages with no detectable Q/A structure.
- Optional AI-assisted FAQ extraction (two-stage): the importer now harvests every scrap of text the page contains — visible content, JSON-LD payloads, and human-readable strings embedded in inline scripts (where JavaScript-rendered sites keep their real FAQ) — and, when an `LLM_API_KEY` is configured (`LLM_PROVIDER=gemini` or `openai`, server-only), has a language model read that corpus with a strict no-invention contract. Every returned pair is then verified against the harvested text by a deterministic grounding layer; hallucinated or ungrounded pairs are dropped, and any AI failure falls back silently to basic extraction (labeled as such on the setup screen). The model's Gemini endpoint is a compile-time constant with the key in a request header, and the whole feature is covered by mocked-LLM route tests plus grounding unit tests.
- Banner heading sections split into per-question pairs: when a section's content contains question-like paragraphs, each becomes its own fact (question with its answer) instead of one page-length entry — so a big "Frequently asked questions" page produces one fact per real question.
- Long fact answers in the session sheet are clamped with a Show more / Show less toggle instead of filling the screen.
- The simulated customer now works from a grounded question plan built from the confirmed, deduplicated facts: one question per fact, asked one at a time, never repeated, phrased naturally in character. In live mode the plan is part of the voice session prompt; if the trainee asks about something the facts do not cover, the customer says they need to check rather than inventing policy details.
- The coaching report's "Next exercise" is now a structured practice task: the customer opening line to rehearse against, what to practice (chosen from the lowest relevant score, a missed fact, or an unsupported claim), the confirmed facts to include, and a short success checklist. Reports saved before this change fall back to the plain suggestion text.
- Motion and states per design engineering review: 200-400ms custom ease-out transitions, 0.97 press feedback, themed browser surfaces (rose selection and caret, themed scrollbars and focus rings), 44px touch targets for Android Chrome, and full `prefers-reduced-motion` support.
- Palette brightened across the app on product-lead feedback, keeping WCAG AA contrast.
- Call-screen composition recorded as accepted deviation (2026-09-17, finish review): the console island sits in the wider left grid column with the session sheet opening at the same y on desktop, rather than spanning both columns; all first-viewport elements remain visible without scroll.
- Preserve safe AssemblyAI session-error codes and browser WebSocket close codes in the recoverable live-call error, rather than replacing them with a generic connection message.

### Fixed

- Clarity coaching now requires at least one supported FAQ fact and no unsupported claim; direct, concise wording only increases a grounded answer's score. The report explanation and clarity drill now lead with the confirmed FAQ answer.

- Editing the session name no longer clears a confirmed source or its selected FAQ scenarios. The source snapshot remains valid and Start practice call stays enabled because the label does not change the grounded reference material.
- Framer-backed FAQ hubs such as `equityedge.io/faq` now import their real linked article facts instead of pairing topic-menu labels into fabricated answers. The importer accepts bounded nested relative article links, reads Framer rich-text state, excludes hub/footer text when article facts exist, and keeps the LLM as a grounded rescue path only when deterministic extraction finds no complete pairs. Gemini now uses the supported `gemini-3.5-flash` endpoint.
- Imported pages whose FAQ section is a list of topic labels no longer produce nonsense Q/A pairs (such as "A: Evaluation Phase" or "A: Slippage"): a question-like line only pairs with following content that reads like an answer (sentence punctuation or a full-length line), consecutive labels are skipped, and the section keeps its full text when no question has a real answer.
- Fact matcher: an evidence window no longer starts in front of a fact's own subject when a sibling fact uses the same word as its relation (for example "delivery" shared across delivery facts). A trainee answer that states a confirmed fact verbatim is now credited instead of being missed; regression test added.
- Empty-call message is readable and clearer: light-red panel with dark-red text (was dark text on a dark red panel), now reading "No answers were recorded in this call, so there is nothing to score. Start a new practice call and answer the customer before ending."
- FAQ import now preserves paragraph structure from imported pages: block-level tags (p, li, headings, table rows, and similar) become line breaks before text extraction, so each page section is extracted as its own reference fact. Previously the whole page collapsed into one page-length "Reference detail" blob, which made factual accuracy score 0 on imported pages because no trainee answer could match it.
- Next exercise quotes at most 180 characters of the missed-fact answer, keeping the suggestion readable when a fact answer is long.
- Source-channel segmented control: the selected option is now clearly visible as a white pill with soft shadow and ink text on the cream track (the Maison Rose port had collapsed the checked state into the track background).
- Oversized-page import error now names the recovery: "This page is 4.6 MB, over the 2 MB import limit. Open the page, copy the FAQ or policy text, and paste it instead." (was "The reference source must be 200 KB or smaller.").
- Remove the home page's "or typed fallback" clause so the copy matches the voice-only practice rule, and tune the mobile headline scale for 320px viewports (product lead approved on 2026-09-17).

- Verify live customer audio and live transcript behavior on a physical Android Chrome device.

- Render customer and trainee transcript deltas while they arrive instead of waiting for a turn to finish.
- Use a native 24 kHz playback context on Chromium browsers and explicitly request full voice-agent output volume.

- Replace the mobile live-microphone `ScriptProcessorNode` path with an AudioWorklet that resamples PCM capture before sending each voice frame, preventing the observed post-opening-turn audio stall on Android Chrome.

- Make live practice voice-only, start microphone capture from `Join voice call`, and remove the unsupported typed-turn protocol path.
- Schedule AssemblyAI PCM customer-audio chunks on one playback timeline and resample browser microphone capture to 24 kHz for clearer cross-browser audio.
- Replace the persistent start-microphone action with Mute/Unmute after a call joins, with a recoverable permission-denied retry state.

- Bind the browser `fetch` receiver before minting a temporary AssemblyAI token, allowing Firefox and Chromium to start live practice calls.
- Use relation-anchored factual evidence in coaching evaluation, tying universal claims to their required condition and treating scoped `not all` as ambiguous.
- Improve evaluation of distinct-topic coordinated factual claims so a supported fact cannot hide another fact's contradiction, and acknowledge partial factual coverage without relying on rounded scores.
- Scope deterministic conflict suppression and negation to the relevant factual clause, recognize common negative contractions, and keep empty or weak-call strengths observational.
- Clear malformed practice storage safely and avoid treating unrelated negative sentences or different confirmed numeric facts as policy contradictions.
- Give each call-console startup exact agent ownership so React StrictMode replay, retry, end, and unmount close obsolete agents and ignore their late events.
- Pin public reference imports to a validated numeric address while preserving HTTPS hostname verification; reject equivalent mapped/private IPv6 forms, special-use ranges, redirects, and oversized or stalled responses.
- Queue live customer audio chunks in order and invalidate active, queued, and decoding playback on interruption or remote termination.
- Make live mute pause frame transmission and disable microphone tracks while reusing the existing capture graph on unmute.
- Guard pending voice-token, socket, and microphone startup against ended sessions; repeated startup and cleanup release resources once.
- Keep microphone permission denial recoverable for live typed turns, and report every remote socket/session termination through the existing error contract.
- Prevent the console from marking an ended call as recording when a pending microphone request completes.

- Emit the mock customer transcript only after speech synthesis starts or transcript-only fallback is selected, preserving the audio-first turn contract.
- Keep mock-customer turns active until browser speech synthesis ends or errors, and until matched fixture playback reports completion; interruptions invalidate pending completion callbacks.
- Prevent mismatched static customer audio for dynamic text, show an explicit transcript-only audio fallback, and suppress fixture audio when an interruption happens during decoding.
- Restore the exact voice-agent transport contract and move mute support behind an optional adapter capability.
- Speak each scripted mock-customer turn with browser speech synthesis, with a bundled WAV fixture used only when speech synthesis is unavailable; interruptions cancel both paths.
- Keep microphone permission failures recoverable with a clearly labelled typed fallback; mute now stops and resumes recognition while flushing customer playback.
- Consume `session-ready` and reject invalid call-state transitions before the session is ready.

- Route setup validation through the authoritative practice-pack contract so unsupported runtime scenarios and incomplete confirmed source snapshots cannot start a session.
- Preserve source URL/content-hash provenance in coaching reports and retain the declared plain-text or Markdown format for normalized experience notes.

- Use the portable Bash `cp .env.example .env.local` command in the README setup block.

- Require confirmed public HTTPS links to retain the sanitized source snapshot and content hash used to ground practice.
- Reject unsupported runtime scenario values before a practice session starts.
