# Structured matcher Task 2 report

Date: 2026-09-17
Base: clean `supportcoach-mvp` HEAD `64b60c2`.

## Scope

Implemented only the approved fact-by-fact matching slice:

- `src/evaluation/structured-fact-matcher.ts`
- `src/evaluation/structured-fact-matcher.test.ts`

The new `matchReferenceFacts` API compiles confirmed facts, derives relation-anchored claim windows, assesses each fact independently, and returns supported fact IDs plus deduplicated original statements containing explicit conflicts. Questions and incomplete or ambiguous statements cannot support or contradict a fact. No evaluator integration, public/domain/storage/API change, new dependency, scenario-specific rule, or source/transcript logging was added.

## Test-first evidence

The matcher tests were added before production behavior. The first focused run of:

```text
npx vitest run src/evaluation/structured-fact-matcher.test.ts
```

produced the expected RED result: exit code 1, 18 failed matcher cases, and `TypeError: matchReferenceFacts is not a function`; the two existing compiler tests remained green.

The initial implementation made 19/20 tests pass. The remaining same-subject/same-relation multi-value example exposed an inherently ambiguous full-statement fallback. The test was corrected to the approved conservative contract—missed fact and no invented unsupported claim—and the implementation now suppresses both credit and conflict when the fallback contains the expected value plus another fact's value. Negative-fact contraction coverage and the required one-correct/two-conflicting-values case were then added before their final production refinements.

The initial Task 2 implementation reached GREEN at 22/22 cases. Independent review then identified three scope defects. Regression tests were added first and reproduced all three together: exit code 1, 22 passed, and 3 failed. The failures showed a leading `no` was discarded before the subject, a restricted `all unopened items` phrase was treated as universalization, and a numeric detail in a later comma-coordinated clause contaminated the policy claim.

The review fixes retain a leading negator as claim context, treat `all` as condition removal only when a required condition is absent, and split at punctuation or comma-coordinated independent-clause boundaries while continuing to avoid splitting on bare `and`. The final focused run is GREEN: exit code 0, one test file passed, and 26/26 tests passed.

## Covered boundaries

- Two correct same-subject facts in either coordinated order.
- One correct and one conflicting same-subject fact in either order.
- Reversed numeric values and two conflicting values in one claim.
- Separate statements do not contaminate each other's numeric evidence.
- Conjunction-required and duplicate/subset facts remain strict.
- Negative contractions, opposite opened/unopened conditions, unconditional promises, and scoped negation.
- Leading negation before a fact subject remains inside its claim scope.
- Restricted quantification such as `all unopened items` remains supported, while removal of the restriction remains conflicting.
- Questions, incomplete claims, unrelated reassurance, and unrelated extra numbers.
- Numeric details in a later independent clause cannot contaminate a correct fact.
- No-relation and same-relation fallbacks remain conservative.
- Unsupported statement evidence is deduplicated by its original text.

## Verification evidence

| Command/check | Observed result |
| --- | --- |
| `npx vitest run src/evaluation/structured-fact-matcher.test.ts` | Exit 0; 1 file and 26/26 tests passed. |
| `npm run typecheck` | Exit 0; `tsc --noEmit` reported no diagnostics. |
| `node .superpowers/sdd/task-5-secret-scan.cjs` | Exit 0; zero credential patterns, browser canary/server-key findings, or tracked private environment files. |
| Changed-file logging/environment scan | No logging, environment access, credentials, private keys, network, or persistence code. |
| `git diff --check` | Exit 0; no whitespace errors. |

## Self-review

- Claim isolation: relation anchors owned by another fact and defensible punctuation/coordinated-clause boundaries constrain each candidate window, so an extra value in another claim cannot contaminate the current fact.
- Conjunction safety: claim windows do not split on `and`; required subject and answer terms stay together.
- Conflict threshold: a relevant window must contain an explicit mismatched number, opposite condition, removed condition, or scoped polarity conflict. Incomplete and ambiguous claims remain missed.
- Negative facts: normalized contractions preserve `not` as a required condition, while the same scoped negation contradicts an affirmative fact.
- Privacy and architecture: all matching is deterministic and in memory. Compiled specifications and trainee/source text are neither persisted nor logged.
- Scope: only the matcher module, its focused tests, and this evidence report changed. Evaluator wiring and project-diary updates remain Task 3 work.

## Limitations

The matcher is intentionally lexical. Unrecognized paraphrases remain missed. When two facts have the same subject and no discriminating relation anchor, a full statement containing both the expected number and another value remains ambiguous; it receives neither credit nor an unsupported claim. This follows the approved preference for a miss over a false contradiction.

## Rollback

Revert this task's single commit. No migration, dependency rollback, public-contract restoration, or persisted-data cleanup is required.
