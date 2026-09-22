# Grounded Coaching, Rotating Drills, and Voice Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent empty answers from earning clarity points, vary source-grounded drill suggestions for repeated imports, and make the live microphone-to-transcript pipeline observable while testing lower voice-activity sensitivity.

**Architecture:** The evaluator reuses structured fact matching as the clarity gate. The setup UI rotates only the displayed six source-derived scenarios and stores a non-sensitive source-hash cursor in localStorage. The live adapter emits transient capture events from browser PCM and provider VAD events to the existing call console.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Vitest, AssemblyAI Voice Agent WebSocket API, browser Web Audio API, localStorage.

## Global Constraints

- Keep trainee practice voice-only; do not add typed replies or a fallback text response.
- Use existing structured FAQ facts only; no model-generated scenarios or coaching facts.
- Store only a source-hash rotation cursor locally; never store audio, API keys, or live diagnostic data.
- Preserve existing test-pinned strings, especially `Microphone: On — speak naturally` before speech is detected.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before deployment.

---

### Task 1: Ground clarity in supported FAQ facts

**Files:** `src/evaluation/deterministic-evaluator.ts`, `src/evaluation/practice-task.ts`, `src/components/coaching-report.tsx`, `src/evaluation/evaluator.test.ts`, `src/evaluation/practice-task.test.ts`.

**Produces:** `scores.clarity` where 0 means no grounded answer, 1 means grounded but indirect/long, 2 means grounded and direct, and 3 means grounded, direct, and concise.

- [ ] Write failing tests: `I will check.` must score clarity 0; a long supported direct fact must score 2; a concise supported direct fact must score 3; a contradiction must score 0.
- [ ] Run `npm test -- src/evaluation/evaluator.test.ts`; the empty direct promise must fail before implementation.
- [ ] Implement the gate: `grounded = factual.supportedFactIds.size > 0 && unsupportedClaims.length === 0`; calculate clarity as `grounded ? score(1 + Number(direct) + Number(concise)) : 0`.
- [ ] Replace the report explanation with `Giving an understandable, FAQ-grounded answer in direct sentences.`
- [ ] Update the clarity drill to lead with the confirmed FAQ answer before sentence-style guidance.
- [ ] Run `npm test -- src/evaluation/evaluator.test.ts src/evaluation/practice-task.test.ts` and commit as `fix: ground clarity coaching in FAQ answers`.

### Task 2: Rotate displayed source-derived drills

**Files:** `src/domain/derived-scenarios.ts`, `src/domain/derived-scenarios.test.ts`, `src/components/source-setup-form.tsx`, `src/components/scenario-picker.tsx`, `src/components/scenario-picker.test.tsx`.

**Produces:** `deriveScenarios(facts, { limit?: number })` and `rotateScenarios(scenarios, cursor, limit)`. The setup component presents six rotating candidates while validation resolves every deterministic scenario ID.

- [ ] Write a failing domain test using eight substantive facts. A six-item window at cursor 0 and cursor 1 must differ, while every rotated item exists in the full candidate set.
- [ ] Run `npm test -- src/domain/derived-scenarios.test.ts`; it must fail because the rotation helper does not exist.
- [ ] Add an optional `limit` to `deriveScenarios`, preserving a default of six. Add `rotateScenarios`: when candidates exceed six, select six from `(cursor * 6) % candidates.length`, wrapping at the end.
- [ ] In `SourceSetupForm`, derive all candidates with `limit: Infinity`; persist an integer cursor at `supportcoach-suggestion-rotation-v1:<contentHash>` after confirmation and increment it on every Refresh action.
- [ ] Pass the rotated six to `ScenarioPicker`. Add optional `allCount` and `onRefresh` props. Render `Refresh suggestions` only when `allCount > displayed.length`; it must not submit the form or alter source confirmation.
- [ ] Add component coverage for refresh and stored-session normalization. Run `npm test -- src/domain/derived-scenarios.test.ts src/components/scenario-picker.test.tsx` and commit as `feat: rotate FAQ practice suggestions`.

### Task 3: Surface capture stages and test lower VAD sensitivity

**Files:** `src/voice/voice-agent.ts`, `src/voice/assemblyai-voice-agent.ts`, `src/components/call-console.tsx`, `src/voice/assemblyai-lifecycle.test.ts`, `src/components/call-console.test.tsx`.

**Produces:** `{ type: "microphone-signal" }` after the first non-silent frame and `{ type: "trainee-speech-started" }` after provider VAD. The console shows connected, signal, and listening states without storing audio.

- [ ] Write failing tests that inspect the session update for `vad_threshold: 0.3`, receive one microphone-signal event after a captured frame, and render `Microphone: Listening to your answer` after provider speech detection.
- [ ] Run `npm test -- src/voice/assemblyai-lifecycle.test.ts src/components/call-console.test.tsx`; these checks must fail before implementation.
- [ ] Change only `turn_detection` to `{ vad_threshold: 0.3, interrupt_response: true }`. Do not alter PCM encoding, capture sample rate, provider URL, token flow, or output audio.
- [ ] Emit `microphone-signal` once per active microphone generation after the first non-zero PCM frame passes existing ready/socket/mute guards. Emit `trainee-speech-started` before the current interruption event when `input.speech.started` arrives. Reset flags on retry, mute, end, and error.
- [ ] Keep the audio worklet unchanged; it only converts PCM. In `CallConsole`, maintain transient microphone stage and show `Microphone: Voice signal detected` then `Microphone: Listening to your answer` after the existing connected copy.
- [ ] Run `npm test -- src/voice/assemblyai-lifecycle.test.ts src/components/call-console.test.tsx src/voice/assemblyai-voice-agent.test.ts` and commit as `fix: surface live voice capture stages`.

### Task 4: Verify, deploy, and hand off

**Files:** `BUGS.md`, `ENHANCEMENTS.md`, `CHANGELOG.md`, `HANDOFF.md`.

- [ ] Run sequentially: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. If Next build changes `.next` while typechecking, rerun typecheck after build.
- [ ] Update the project diary. Mark suggestion rotation complete in `ENHANCEMENTS.md`; add Unreleased entries. Keep the voice bug open until physical-device verification succeeds.
- [ ] Deploy with `npx vercel --prod --yes --scope adam-a4` and inspect `https://supportcoach-ai-ten.vercel.app` using `npx vercel inspect https://supportcoach-ai-ten.vercel.app --scope adam-a4`.
- [ ] On a physical phone: import EquityEdge, refresh suggestions, start a live call, speak at normal volume, and verify in order: signal detected, listening, trainee transcript, AI follow-up. If false interruptions occur, restore VAD threshold 0.5.
- [ ] Run `npm run handoff`, complete `HANDOFF.md` with commits, checks, deployment, and device-test outcome, then commit and push documentation.
