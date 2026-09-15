# Task 3 report — normalized sources and setup

## Delivered

- Extended the Task 1 domain contract with scenario metadata and added independent transcript and coaching-report types.
- Added source normalization that retains the source URL/snapshot hash, extracts question-and-answer facts, includes approved practice advice as facts, and retains personal coaching notes without using them for fact matching.
- Added field-level validation for company name, source confirmation/content/URLs, fact quality and uniqueness, scenario fact resolution, and the 200 KB note-file limit.
- Added the seeded late-delivery and refund-eligibility scenario archetypes plus fallback facts for local mock use.
- Added `/setup`, where the source preview must be explicitly confirmed before the practice-call action can be enabled. The UI states that the trainee is the voice responder and the customer is simulated from the confirmed material.

## TDD evidence

`src/domain/validation.test.ts` was created before `src/domain/validation.ts`. Its first focused run failed because the requested validation module did not yet exist; after the minimal implementation, it passed. The tests cover a valid context and each required validation rejection, including personal-note exclusion from factual fact matching.

## Verification

- `npm test -- src/domain/validation.test.ts` — 4 passing tests.
- `npm test` — 12 passing tests across 2 files.
- `npm run lint` — no lint errors or warnings (Next.js prints its existing `next lint` deprecation notice).
- `npm run typecheck` — passed.
- `npm run build` — passed; `/setup` is included in the generated static pages.

## Self-review

The domain layer imports no React or browser APIs. File handling is local to the client-side setup component. Validation prevents a session from being marked ready until the preview is confirmed, and scenarios only reference fact IDs available in the current normalized source. No unrelated Task 1/2 files were changed.

## Follow-up boundary

The public-link input accepts the extracted snapshot in the UI; server-side fetching, sanitization, and hashing of public pages remain the responsibility of the later source-import integration task. The domain already preserves the confirmed URL and content hash for that integration and for report provenance.
