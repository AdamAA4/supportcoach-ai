# Structured matcher Task 1 report

Date: 2026-09-17
Base: clean `supportcoach-mvp` HEAD `14dc621735e91ced8496bb78a673537bfb3f7c2c`.

## Scope

Implemented only the approved fact-compiler slice:

- `src/evaluation/structured-fact-matcher.ts`
- `src/evaluation/structured-fact-matcher.test.ts`

The compiler normalizes answer text deterministically, removes low-information function words, groups numbers with nearby units, classifies condition terms, derives shared/conjunction-required subjects and discriminating relations, and returns a `Map<string, FactMatchSpec>` keyed by fact ID. The exact five-field `FactMatchSpec` type remains private to the evaluation module.

No evaluator integration, matching/assessment behavior, scenario-specific vocabulary, dependency, storage, API/domain contract, or project-diary/progress-ledger change was made.

## Contract check

The Task 1 brief's examples compile against the existing `ReferenceFact` definition. The approved design and Task 1 brief use the same exact internal `FactMatchSpec` boundary:

- `subjectTerms: string[]`
- `relationTerms: string[]`
- `valueTerms: string[]`
- `conditionTerms: string[]`
- `requiredTerms: string[]`

The task's prescribed implementation consumes `fact.answer`; it neither mutates nor widens `ReferenceFact`. The `keywords` fixture argument remains available to demonstrate compatibility with the source type, but this compiler slice introduces no new keyword or scenario rules.

## Test-first evidence

The compiler test file was created before production code. Running:

```text
npx vitest run src/evaluation/structured-fact-matcher.test.ts
```

produced the expected RED result: exit code 1, one failed suite, and Vite's `Failed to resolve import "./structured-fact-matcher"` error because the production module did not yet exist.

After adding the minimal approved compiler implementation, the same command produced GREEN: exit code 0, one test file passed, and 2/2 tests passed. The tests cover the exact shared-subject relation/value classification and the conjunction-required subject/conservative fallback example from the task brief.

## Verification evidence

| Command/check | Observed result |
| --- | --- |
| `npx vitest run src/evaluation/structured-fact-matcher.test.ts` | Exit 0; 1 file and 2/2 tests passed. |
| `npm run typecheck` | Exit 0; `tsc --noEmit` reported no diagnostics. |
| `node .superpowers/sdd/task-5-secret-scan.cjs` | Exit 0; zero credential patterns, browser canary/server-key findings, or tracked private environment files. |
| Changed-file logging/environment scan | No `console`/logger calls, environment reads, credentials, or private-key markers. |
| Diff whitespace review | No whitespace errors. |

## Self-review

- Architecture and contracts: compilation is isolated in the evaluation layer. `FactMatchSpec` is not exported, persisted, logged, or added to a public API. `ReferenceFact` is imported as a type and remains unchanged.
- Determinism and totality: compilation uses local token/set operations only. Empty or low-information answers still produce a map entry and conservative arrays without throwing.
- Scope: only the compiler, its focused tests, and this evidence report changed. Evaluator integration and matcher behavior remain for later tasks.
- Security and privacy: the implementation has no I/O, network access, environment access, storage, or logging. It processes in-memory confirmed fact text and returns in-memory specifications.
- Maintainability: constants keep lexical categories explicit; normalization and value extraction are small pure functions; insertion-ordered sets preserve stable term order.
- Limitations: this is deterministic lexical compilation, not semantic understanding. The approved vocabulary and numeric-unit window define the current classification boundary. The design's broader matcher and ambiguity behavior are intentionally not implemented in this slice.

## Rollback

Revert this task's single commit. No migration, dependency rollback, persisted-data cleanup, or public contract restoration is required.
