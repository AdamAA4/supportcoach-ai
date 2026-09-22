# Task 2 report: rotate FAQ practice suggestions

## Delivered

- `deriveScenarios` accepts an optional limit, retaining six as its default.
- `rotateScenarios` returns a wrapping window beginning at `(cursor * limit) % candidates.length`.
- The setup form derives the complete deterministic candidate set, displays a rotated six-item window, and keeps all candidate IDs valid for session reconstruction.
- Confirming a source reads and normalizes the local rotation cursor at `supportcoach-suggestion-rotation-v1:<contentHash>`, stores the next cursor, and refresh advances and persists it without submitting the form or changing confirmation.
- The picker shows `Refresh suggestions` only when additional candidates exist.

## Test-first evidence

1. Added the eight-fact domain rotation test; it failed as expected because `rotateScenarios` did not exist.
2. Added the refresh-control test; it failed as expected because the button was absent.
3. Added the all-candidate resolution assertion; it failed as expected because `findDerivedScenario` was still capped at six.

## Verification

- `npm test -- src/domain/derived-scenarios.test.ts src/components/scenario-picker.test.tsx src/voice/assemblyai-voice-agent.test.ts` — 25 tests passed.
- `npm run typecheck` — passed.
- `npm test` — 23 files and 258 tests passed.
- `git diff --check` — passed.

## Self-review

The change uses existing React state, local storage, and component styles; it adds no dependency, API, schema, or source-confirmation contract change. `type="button"` prevents refresh from submitting the setup form. Stored values accept only non-negative safe integers; malformed, fractional, negative, and unsafe values normalize to cursor zero when a confirmed source is stored. No open issue was found in the changed scope.
