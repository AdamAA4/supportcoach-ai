# Structured Fact Matcher Design

Date: 2026-09-16  
Status: Approved design, pending implementation plan

## Problem

The deterministic evaluator currently uses lexical topic boundaries to associate trainee statements with confirmed FAQ facts. That approach cannot reliably distinguish two facts that share the same leading subject, such as:

- Refunds are available within 30 days.
- Refunds are processed within 5 business days.

When a trainee states both facts in one coordinated sentence, the evaluator can attach both numbers to both facts and incorrectly mark correct answers as conflicting. Three focused heuristic repairs exposed further ambiguity around shared subjects and conjunction-required facts. The rejected attempts and reproductions are recorded in `.superpowers/sdd/task-6-report.md`.

## Goal

Evaluate each confirmed FAQ fact independently using an internal structured match specification, so evidence supporting one fact cannot hide, contaminate, or contradict another fact. The matcher must continue to support FAQ content supplied for each practice session without scenario-specific scoring rules.

## Constraints

- Keep the existing Next.js, React, TypeScript, Tailwind, Vitest, and Playwright stack.
- Add no runtime dependency or external AI/model call.
- Preserve the public `ReferenceFact`, `Evaluator`, `CoachingReport`, API, and persisted-data contracts.
- Score only trainee turns against confirmed normalized FAQ/reference facts.
- Personal coaching notes may influence the next exercise but never factual credit.
- Prefer a missed fact when evidence is ambiguous. Report an unsupported claim only when the trainee states an identifiable conflicting value or condition.
- Do not add scenario-specific refund, delivery, or exchange rules.

## Selected Approach

Create an internal compiled matcher. At evaluation time, each existing `ReferenceFact` is compiled into a private `FactMatchSpec` derived from its answer and keywords. The compilation is deterministic and local to the evaluation layer.

Conceptually, a match specification contains:

```ts
type FactMatchSpec = {
  subjectTerms: string[];
  relationTerms: string[];
  valueTerms: string[];
  conditionTerms: string[];
  requiredTerms: string[];
};
```

This exact internal type is the implementation boundary. It does not change the stored or API-facing fact schema.

## Components

### Fact compiler

Owns conversion from a confirmed fact into a match specification. It normalizes contractions and punctuation, removes low-information function words, retains numbers and units together, and identifies terms that distinguish facts sharing a subject.

The compiler must keep conjunctions that are part of one fact, such as “refunds and exchanges,” while allowing two facts that both begin with “refunds” to be distinguished by relation and value terms such as “available / 30 days” and “processed / 5 business days.”

### Claim segmenter

Splits trainee statements only at defensible claim boundaries. It may use punctuation, contrast markers, and compiled relation/value anchors. It must not split every use of “and,” because “and” can be required inside a single fact.

The segmenter returns candidate claims without deciding whether they are correct.

### Fact assessor

Assesses each fact independently against candidate claims:

1. Select claims with sufficient subject or distinguishing relation evidence.
2. Mark the fact supported only when its required relation, values, and conditions are present without an explicit conflict.
3. Mark an unsupported claim only when a relevant claim contains an identifiable conflicting value, condition, negation, or opposite term.
4. Leave ambiguous or incomplete claims as missed facts without inventing a contradiction.

Support for one fact must never suppress a conflict found for another fact.

### Deterministic evaluator

Continues to own score calculation, strengths, next exercise, transcript preservation, and source provenance. It delegates factual support/conflict decisions to the structured matcher. Its public interface and report format remain unchanged.

## Data Flow

1. The evaluation route validates the request and reconstructs the confirmed active context as it does today.
2. `DeterministicEvaluator` filters out personal-note facts and selects the scenario’s confirmed reference facts.
3. The matcher compiles each selected fact into a private match specification.
4. Trainee turns are segmented into candidate claims.
5. Each fact is assessed independently against those claims.
6. The evaluator receives supported fact IDs and unsupported claim evidence, then produces the existing four scores and coaching report.

No compiled match specifications are persisted, exposed through the API, or logged.

## Error and Ambiguity Handling

- Empty trainee content produces missed facts and no unsupported claims.
- A claim with the correct subject but insufficient relation/value evidence is missed, not accepted.
- A claim containing two correct same-subject facts must credit both.
- A claim containing one correct and one conflicting same-subject fact must credit the correct fact and report only the conflicting evidence.
- A conjunction-required fact must remain assessable as one fact.
- Unrecognized paraphrases remain a documented limitation of the deterministic matcher; they must not cause false factual credit.
- Matcher compilation must be total for every validated `ReferenceFact`. If a fact lacks enough discriminating structure, the matcher falls back to conservative required-term matching for that fact.

## Testing Strategy

Implementation follows test-first development. Focused tests must fail against the current evaluator before production changes.

Required regression groups:

- Two correct same-subject numeric facts in both orders.
- One correct and one contradictory same-subject fact in both orders.
- Multiple facts sharing subject and relation but differing by values or conditions.
- A single fact whose subject or answer requires a conjunction.
- Existing distinct-topic coordinated claims.
- Existing negation, contraction, opposite-condition, extra-number, trainee-only, partial-strength, and personal-note boundaries.
- Ambiguous and incomplete statements remain missed without becoming unsupported claims.

After focused matcher/evaluator tests pass, run lint, type checking, the full test suite, production build, staged diff review, and the existing secret scan. An independent Task 6 review must approve the complete diff before the progress ledger marks Task 6 complete.

## Documentation and Rollback

The implementation must update `CHANGELOG.md`, `ENHANCEMENTS.md`, and `BUGS.md`. The open Task 6 bug may be archived only after focused tests, full verification, and independent review pass.

The matcher is isolated in the evaluation layer, so rollback consists of reverting its implementation commit and retaining the current conservative evaluator plus the documented known bug. No stored-data migration or dependency rollback is required.

## Out of Scope

- External language models or semantic embedding services.
- Changes to FAQ importing or source normalization contracts.
- Authentication, server-side session storage, or report persistence changes.
- New scenarios, UI redesign, or changes to the four-score rubric.
- General natural-language understanding beyond the approved deterministic matcher.
