# Grounded coaching, rotating drills, and voice-capture design

**Status:** approved direction; awaiting review before implementation  
**Date:** 2026-09-22

## Objective

Make coaching clarity reward a useful FAQ-grounded answer, offer varied practice drills from the same confirmed FAQ, and make live voice-capture failure visible while testing one measured provider configuration adjustment.

## Scope

### 1. Grounded clarity

Clarity remains separate from factual accuracy: factual accuracy measures coverage and contradictions across the scenario facts, while clarity measures whether the customer can understand and use the trainee's response.

The evaluator will use the existing structured fact matcher. A response cannot receive clarity credit for sentence style unless it supports at least one confirmed fact relevant to the selected scenario.

| Clarity score | Rule |
| --- | --- |
| 0 | No supported scenario fact, or an unsupported contradictory claim. |
| 1 | At least one supported scenario fact, but the answer is not direct or is hard to scan. |
| 2 | A supported fact is stated directly, even when the sentence is long. |
| 3 | A supported fact is stated directly in concise sentences. |

The report copy and clarity next-exercise checklist will say that the trainee should lead with the confirmed answer. A response such as “I will check” will receive no clarity credit by itself.

### 2. Rotating FAQ suggestions

The full set of substantive source-derived scenarios remains deterministic and source-grounded. The setup screen will display at most six suggestions at one time.

For a confirmed source with more than six candidates:

- A fresh import selects the next six-topic window.
- **Refresh suggestions** advances to another window without re-importing or changing the confirmed source.
- The rotation is stored in browser localStorage under the source content hash, so re-importing the same unchanged FAQ does not immediately repeat the previous set.
- A source with six or fewer candidates remains unchanged.
- Scenario IDs, selected scenario validation, question plans, and factual scoring still use the full deterministic candidate set. The rotation affects only what the picker initially displays.

No model generation is involved. This keeps each suggestion traceable to an imported FAQ fact and avoids invented scenarios.

### 3. Voice capture

Observed behavior: on a phone, the customer can be heard but the trainee transcript can be empty; speaking loudly can capture only a few words. Browser microphone permission and audio output are both enabled.

The live adapter already sends documented 24 kHz mono PCM16 frames and handles the documented user transcript events. The first test changes one provider value only: explicitly set `input.turn_detection.vad_threshold` to `0.3` (from the provider's default `0.5`) so quieter or phone-captured speech starts a user turn more readily.

The call console will expose non-recording diagnostic stages:

1. **Microphone connected** after browser permission succeeds.
2. **Voice signal detected** after the browser sends a non-silent capture frame to the live session.
3. **Listening to your answer** after the provider emits `input.speech.started`.
4. The existing live transcript after the provider emits transcript text.

No raw audio, transcript diagnostics, API key, or session data is persisted or sent anywhere beyond the existing live voice connection. The new indicators are local, transient call state.

If a frame reaches the app but the provider never emits speech detection, the UI will say so clearly rather than claiming that the microphone is working. This gives a device test a precise outcome without reintroducing text practice.

## Files and boundaries

- `src/evaluation/deterministic-evaluator.ts`: derive clarity from existing structured-fact-match result plus style signals.
- `src/evaluation/practice-task.ts` and `src/components/coaching-report.tsx`: align explanation and next-exercise copy.
- `src/domain/derived-scenarios.ts`: expose all valid candidates and a deterministic rotation helper without changing scenario definitions.
- `src/components/source-setup-form.tsx` and `src/components/scenario-picker.tsx`: manage the local rotation and render Refresh suggestions.
- `src/voice/assemblyai-voice-agent.ts`, `src/voice/voice-agent.ts`, `public/pcm-capture-worklet.js`, and `src/components/call-console.tsx`: add transient capture lifecycle events and the single VAD change.

## Verification

- Regression tests: empty direct phrase earns clarity 0; grounded long/direct response earns 2; grounded concise/direct response earns 3; contradiction earns 0.
- Scenario tests: a FAQ with more than six candidates produces a different displayed window after refresh, while all scenario IDs still resolve through session validation.
- Voice adapter tests: session update contains VAD threshold 0.3; capture signal and provider speech events reach the console; muted/ended capture produces no late events.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- Deploy after checks, then test one real phone call. Success requires: a voice-signal indicator, a provider listening indicator, partial or final trainee transcript, and an AI follow-up. Until that device test passes, the live-voice fix remains unverified.

## Risks and rollback

Lower VAD can react to background noise sooner. If it creates false interruptions, restore the threshold to `0.5`; the change is a one-line session configuration rollback. Suggestion rotation reads only the source hash and selected IDs already held in the browser, and can be removed without affecting saved practice contexts.
