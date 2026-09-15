# Task 4 report — voice adapter and mock practice call

## Delivered

- Added the shared `VoiceAgent`/`VoiceAgentEvent` contract and a `MockVoiceAgent` that emits a session-ready event, generated WAV customer audio, final transcripts, interruption events, and deterministic source-aware follow-up questions.
- Added a browser `AudioPlayer`, Web Speech recognition when available, typed fallback, and a visible **Mock customer turn** control for browser automation without audio hardware.
- Added the explicit `idle → connecting → customer-speaking → listening → processing → ended` call state machine. Errors are terminal until retry; interruptions stop queued mock audio and return the call to listening.
- Connected source setup to a persisted current-session context. `/call` re-validates that the FAQ/policy snapshot and notes are confirmed before rendering the call.
- Added the practice call UI: source-aware scenario heading, reference facts and notes, provenance metadata and canonical URL, microphone/customer-audio activity, mute/end controls, timestamped speaker transcript, and no suggested-answer surface while the trainee responds.

## TDD evidence

- `src/voice/voice-agent.test.ts` was created before the voice modules. Its first focused run failed because `mock-voice-agent` did not exist. The tests then passed after minimal transport and mock-adapter implementation.
- `src/components/call-console.test.tsx` was created before `CallConsole`. Its first focused run failed because the component did not exist. It now verifies error/retry rendering with the reference panel retained and that typed text is only added after submission.

## Verification

- `npm test -- src/components/call-console.test.tsx src/voice/voice-agent.test.ts` — 8 passing tests.
- `npm run lint` — no ESLint warnings or errors. Next.js prints its existing `next lint` deprecation notice.
- `npm run typecheck` — passed.
- `npm test` — 22 passing tests across 4 files.
- `npm run build` — compilation, type validation, data collection, static-page generation, final page optimization, and build-trace collection all completed in output; the local command runner did not return an exit code within its 30-second execution window, so a fully completed build exit is **not verified**.
- `git diff --check` — passed.

## Self-review

`src/voice/voice-agent.ts` is the stable boundary for the Task 5 live adapter; it carries no vendor or API-key detail. The mock adapter stays within the approved trainee-to-simulated-customer product boundary. The call route re-runs the authoritative source validation before a connection can be established, so stale or unconfirmed browser data cannot enter a practice call. The reference panel stays rendered in error and active call states.

## Concern

On this Windows runner, `next build` consistently reached its final trace stage but did not return a process exit inside the runner's 30-second limit. The preceding compile, lint/type, static-generation, and trace stages showed no failure. Re-run `npm run build` in a normal terminal to capture the final exit before release.

## Review-finding remediation — 2026-09-15

### Delivered

- Replaced the generated sine wave with two bundled, browser-playable spoken WAV fixtures: one opening and one deterministic follow-up. The mock adapter emits their fixture URLs while preserving its deterministic transcript events and transport boundary.
- Added `setMuted(muted)` to the adapter contract. Muting stops Web Speech recognition and flushes current customer playback; unmuting resumes recognition when it was active.
- Treat microphone permission/runtime failures as a recoverable, labelled typed-fallback state. Connection and playback failures remain terminal call errors with retry, while typed turns stay enabled after microphone denial.
- Made `session-ready` an explicit consumed transition (`connecting → listening`) and reject turn events that arrive before readiness or outside a valid state.
- Added UI tests for the normal active-call typed turn, interruption/playback flush and mute/resume behavior, microphone-denied typed fallback, and reference availability during active calls.

### TDD evidence

- `npm test -- src/voice/voice-agent.test.ts src/components/call-console.test.tsx` first failed with the expected missing fixture export, invalid pre-ready reducer transition, terminal microphone-denied UI state, and absent adapter mute call. After the smallest implementation changes it passed: 13 tests.
- A subsequent active-call UI test initially exposed that `CallConsole` did not consume `session-ready`; adding that event branch produced the intended `customer speaking` state and made the test pass.

### Verification

- `npm test -- src/voice/voice-agent.test.ts src/components/call-console.test.tsx` — passed, 13 tests across 2 files.
- `npm run lint` — passed with no ESLint warnings or errors; Next.js printed its existing `next lint` deprecation notice.
- `npm run typecheck` — passed.
- `npm test` — passed, 27 tests across 4 files.
- `npm run build` — passed with exit code 0 after 56 seconds. Compilation, type validation, static generation, final optimization, and trace collection completed; `/call` builds as a static route (6.29 kB, 112 kB first load).
- `git diff --check` — passed.

### Self-review and concern

The adapter remains the only voice boundary and keeps customer audio, source setup, and deterministic transcript paths separate. Source confirmation gating, the trainee-as-responder boundary, no suggested-answer surface, and no source/transcript logging were not changed. The WAV fixtures are deterministic offline assets generated with Windows SAPI and do not require a microphone or API key. Browser unit tests cannot decode/play real audio because JSDOM has no `AudioContext`; the production build includes both fixtures and `AudioPlayer` loads them only in a browser with Web Audio support.

## Final review-finding remediation — 2026-09-15

### Delivered

- Restored `VoiceAgentEvent` and `VoiceAgent` exactly to the Task 4 brief: `customer-audio` contains only `audio`, and `setMuted` is no longer part of the public adapter interface.
- Kept mute behavior as an optional internal adapter capability. The call console always stops its local playback and calls the mandated `interruptCustomer`; the mock capability additionally stops/resumes Web Speech recognition.
- Replaced fixture-URL playback with browser `speechSynthesis` of the exact scenario opening and deterministic source-aware follow-up text. In browsers without synthesis, the mock fetches and emits the bundled opening WAV through the unchanged `customer-audio` `ArrayBuffer` event.
- Interruption cancels active speech synthesis; pending fallback fixture audio is suppressed after interruption, while the call console stops active `AudioPlayer` playback when it consumes the interruption event.

### TDD evidence

- The dynamic-speech regression test first failed with no `speechSynthesis` calls. The smallest mock-adapter change made it pass with the exact opening and follow-up strings.
- The fixture-fallback regression initially failed before its async fixture event had settled; it now waits for the real asynchronous `ArrayBuffer` event and verifies the unchanged event shape. The interruption regression verifies pending fixture data is not emitted after interruption.

### Verification

- `npm test -- src/voice/voice-agent.test.ts src/components/call-console.test.tsx` — passed, 16 tests across 2 files.
- `npm run typecheck` — passed.
- `npm run lint` — passed with no ESLint warnings or errors; Next.js printed its existing `next lint` deprecation notice.
- `npm test` — passed, 30 tests across 4 files.
- `npm run build` — passed with exit code 0 after 52 seconds. Compilation, type validation, static generation, final optimization, and trace collection completed; `/call` builds as a static route (6.42 kB, 112 kB first load).
- `git diff --check` — passed.
