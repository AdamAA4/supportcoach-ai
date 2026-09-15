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
