# Task 1 report — approved per-session source contract

## Status

Implemented and committed the source-input decision record and browser-independent `practice-pack` domain contract.

## Changes

- Added `docs/decisions/001-product-inputs.md`, recording the approved voice-responder role, mandatory per-session source setup, one-time public-link snapshot confirmation flow, note formats and classifications, two scenarios, four-score rubric, browser retention, fallback, browser target, and deferred scope.
- Added `src/domain/practice-pack.ts`, which exports source, note, scenario, and score types/constants plus session-input validation without React or browser dependencies.
- Added Vitest coverage for valid pasted source setup, required source enforcement, confirmation, notes format/classification, and exact scenario/rubric sets.
- Updated the PRD where its older three-scenario/five-score language conflicted with this approved task brief.
- Added the required project diary files and deferred PDF/DOCX notes and private-link support to `ENHANCEMENTS.md`.

## TDD evidence

1. The first focused test run failed because `src/domain/practice-pack.ts` was absent.
2. A subsequent red run identified the HTTPS protocol comparison and missing runtime note-classification validation.
3. The final focused run passed: 6 tests in 1 file.

## Verification

- `npm test -- tests/domain/practice-pack.test.ts` — passed, 6 tests.
- `npm test` — passed, 6 tests in the full available suite.
- `npx tsc --noEmit` — passed with exit code 0.
- `git diff --check` — no whitespace errors.

## Review and concerns

- The source contract deliberately treats a public-link URL as an HTTPS-shaped input only. The future server importer must enforce DNS/IP public-network filtering, timeout, fetch-once behavior, sanitization, extraction, and response-size limits; these server-boundary controls are recorded in the decision.
- This skeleton has no lint or production-build script yet, so those checks are not available for Task 1.
- `npm install` reported two moderate dependency-audit findings; they were not changed in this focused domain task and should be reviewed when the app stack is assembled.
