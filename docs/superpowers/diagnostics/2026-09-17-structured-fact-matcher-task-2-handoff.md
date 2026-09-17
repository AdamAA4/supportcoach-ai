# Structured Fact Matcher Task 2 Diagnostic Handoff

Date: 2026-09-17

## Status

Task 2 is not approved for evaluator integration. The matcher is isolated from the evaluator, so the current application behavior has not changed. At head `0b3d41c`, the focused matcher suite passes 35/35 tests and the full application suite passes 184/184 tests, but independent adversarial review still finds Important correctness gaps.

## Attempts completed

1. Initial fact-local matcher implementation at `dcdd77c`.
2. First corrective round at `ca8b211` for leading negation, restricted `all`, and numeric evidence in later clauses.
3. Second corrective round at `0b3d41c` for broader negation scope, comma-free contrast clauses, noun-subject clauses, and condition-specific universalization.

The two corrective rounds improved the tests from 22 to 35 cases. Both independent re-reviews found nearby failures caused by the same architectural weakness. Per the project debugging rule, further speculative edits stopped here.

## Remaining reproductions

| Case | Required result | Current result |
| --- | --- | --- |
| `Refunds are available within 30 days for all items.` | Unsupported because `all items` explicitly removes the unopened-item restriction | Missed as ambiguous |
| `Refunds are available within 30 days for unopened items regardless of payment method.` | Supported; the extra phrase does not remove a confirmed condition | Unsupported |
| `Not all refunds are available within 30 days for unopened items.` | Must not support the affirmative fact | Incorrectly supported |
| `Refunds are available within 30 days for unopened items, the support team checks the order in 2 minutes.` | Support the refund fact and ignore the unrelated number | Unsupported because `2` contaminates the fact window |

## Root causes

1. **Sentence segmentation is doing too much work.** The matcher tries to infer independent clauses from punctuation, a short auxiliary list, and known relations. Ordinary lexical predicates can escape those boundaries.
2. **Negation is attached to token position instead of a fact claim.** Bounded lookback rules handle some forms but lose others such as `not all` before the subject.
3. **Universal words are evaluated globally instead of against a specific condition phrase.** `all items` should remove an item restriction, while `regardless of payment method` should not affect an unopened-item restriction.
4. **Extra numbers are treated as conflicts before they are anchored to the fact's relation.** This lets unrelated measurements contaminate an otherwise correct answer.

## Recommended redesign

Replace generic clause parsing with relation-anchored evidence spans:

1. Find the subject and relation for one reference fact.
2. Build a narrow evidence span around that relation rather than treating the rest of the sentence as part of the claim.
3. Credit a fact only when its required value and conditions appear in that span and no scoped negation targets the subject/relation pair.
4. Report an unsupported claim only for a direct, anchored contradiction: a conflicting value attached to the same relation, a negation attached to the same claim, or a universal phrase that explicitly replaces a required condition head.
5. Ignore unrelated values and unrelated universal phrases. When evidence cannot be confidently anchored, leave the fact missed.

This keeps evaluation deterministic and local, avoids a new dependency or model call, and follows the approved rule that ambiguity must not become an accusation.

## Other options requiring Product + Technical Lead approval

- Add a small natural-language parser dependency for clause and negation scope. This improves grammatical coverage but increases dependency and deployment risk for the hackathon.
- Use a language-model verification call only for ambiguous claims. This can handle paraphrases better but adds latency, cost, usage, and non-determinism.

## Exit criteria for the recommended redesign

- All 35 existing matcher tests pass.
- All four remaining reproductions above pass.
- Coordinated same-subject facts remain separable.
- Reversed numeric values remain unsupported.
- Required conjunctions remain strict.
- Questions cannot supply factual support.
- Uncertain claims remain missed.
- The matcher stays isolated until a fresh independent review reports no Critical or Important findings.

