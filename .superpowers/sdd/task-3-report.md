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

## Review-finding remediation — 2026-09-15

### Fixed

- `validatePracticeContext` now calls Task 1's authoritative `validatePracticePack` and maps its scenario, note, and source-snapshot failures to setup fields. This rejects arbitrary runtime scenario IDs and confirmed URL snapshots with blank content hashes before a session can begin.
- `PracticeContext` now creates immutable `SourceProvenance`, retaining the confirmed public URL when present and the source content hash. `CoachingReport` requires that provenance so score outputs can carry their grounding evidence.
- Normalized `ExperienceNote` values now retain Task 1's explicit `plain-text` or `markdown` format with their approved-advice or personal-note classification. The setup UI selects the format, derives it from a `.md` file upload, and continues to exclude personal notes from source-fact matching.

### TDD evidence

- Added the unsupported-runtime-scenario, blank-confirmed-hash, provenance-retention, and note-format retention assertions to `src/domain/validation.test.ts` before the implementation. The initial focused run failed exactly because setup validation returned `{ ok: true }` for the invalid scenario and report provenance was undefined. After the minimal domain and UI changes, the focused suite passed.

### Verification

- `npm test -- src/domain/validation.test.ts tests/domain/practice-pack.test.ts` — 14 passing tests across 2 files.
- `npm run lint` — passed with no ESLint errors or warnings; Next.js printed its existing `next lint` deprecation notice.
- `npm run typecheck` — passed.
- `npm test` — 14 passing tests across 2 files.
- `npm run build` — passed; static `/setup` page generated successfully.
- `git diff --check` — passed; no whitespace errors.

### Self-review and concern

The UI continues to make the trainee the voice responder and the customer a simulation grounded in the confirmed session source. Personal coaching notes remain available in context but never become facts. The report contract is intentionally type-level because Task 3 does not yet create runtime coaching reports; the later call/report producer must copy `PracticeContext.sourceProvenance` into its required `CoachingReport.sourceProvenance` field.

## Review-finding remediation — 2026-09-15 (setup invalidation)

### Fixed

- Centralized setup invalidation in `src/components/source-setup-form.tsx` so changing source kind, company name, source text or preview, scenario, notes, note kind, note format, or note file clears both confirmation and the ready status. Start remains gated by source confirmation and submit validation.

### Verification

- `npm test -- --run src/domain/validation.test.ts tests/domain/practice-pack.test.ts` — 14 passing tests across 2 files.
- `npm run lint` — passed with no ESLint warnings or errors; Next.js printed its existing `next lint` deprecation notice.
- `npm run typecheck` — passed.
- `npm run build` — passed; static `/setup` page generated successfully.
- `git diff --check` — passed; no whitespace errors.

### Self-review

The change is limited to setup state transitions and preserves the Task 3 domain contracts. Every setup field that can alter the normalized context now uses the same invalidation path, preventing stale green readiness after a successful validation.
