# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Motion and states per design engineering review: 200-400ms custom ease-out transitions, 0.97 press feedback, themed browser surfaces (rose selection and caret, themed scrollbars and focus rings), 44px touch targets for Android Chrome, and full `prefers-reduced-motion` support.
- Palette brightened across the app on product-lead feedback, keeping WCAG AA contrast.
- Call-screen composition recorded as accepted deviation (2026-09-17, finish review): the console island sits in the wider left grid column with the session sheet opening at the same y on desktop, rather than spanning both columns; all first-viewport elements remain visible without scroll.
- Preserve safe AssemblyAI session-error codes and browser WebSocket close codes in the recoverable live-call error, rather than replacing them with a generic connection message.

### Fixed

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
