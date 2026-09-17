# Relation-Anchored Fact Matcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the matcher’s grammar-like clause heuristics with fact relation-anchored evidence so unrelated prose cannot create false factual conflicts.

**Architecture:** Keep `FactMatchSpec`, `FactualMatchResult`, and `matchReferenceFacts` unchanged. For each fact and trainee statement, create evidence spans anchored on that fact’s relation tokens; evaluate values, conditions, and negation only inside the span. Emit an unsupported claim only when an anchored contradiction is identifiable; otherwise leave the fact missed.

**Tech Stack:** Existing Next.js 15, TypeScript, Vitest. No dependency, API, persistence, UI, or AI-model changes.

## Global Constraints

- Preserve the private `FactMatchSpec` fields and exported `matchReferenceFacts` signature exactly.
- Score only non-question trainee statements against confirmed `ReferenceFact.answer` content.
- Add no runtime dependency or external AI/model call.
- Do not modify the evaluator, public contracts, storage, API, UI, or report format in this task.
- A fact may be supported only with its own relation, required value, and required condition evidence.
- A claim is unsupported only for a direct fact-anchored contradiction; ambiguous or incomplete content is missed.
- Never add refund-, delivery-, or scenario-specific logic.
- No source, note, transcript, or compiled-spec logging.

---

### Task 1: Replace grammar-like windows with relation-anchored evidence spans

**Files:**
- Modify: `src/evaluation/structured-fact-matcher.ts`
- Modify: `src/evaluation/structured-fact-matcher.test.ts`
- Modify: `BUGS.md`
- Modify: `CHANGELOG.md`
- Modify: `ENHANCEMENTS.md`
- Create: `.superpowers/sdd/relation-anchored-matcher-task-1-report.md`

**Interfaces:**
- Consumes: `ReferenceFact[]` and trainee `{ text: string; isQuestion: boolean }[]`.
- Preserves: `compileFactMatchSpecs(facts): Map<string, FactMatchSpec>` and `matchReferenceFacts(facts, statements): FactualMatchResult`.
- Produces: fact-local supported IDs and de-duplicated full-statement unsupported evidence.

- [ ] **Step 1: Write the failing regressions for the four diagnostic cases.**

Add focused tests that call the real matcher with the existing eligibility fact. Assert these exact outcomes:

```ts
const unsupportedUniversal = "Refunds are available within 30 days for all items.";
expect(matchReferenceFacts([eligibility], [{ text: unsupportedUniversal, isQuestion: false }]))
  .toMatchObject({ supportedFactIds: new Set(), unsupportedClaims: [unsupportedUniversal] });

const irrelevantQualifier = "Refunds are available within 30 days for unopened items regardless of payment method.";
expect(matchReferenceFacts([eligibility], [{ text: irrelevantQualifier, isQuestion: false }]))
  .toMatchObject({ supportedFactIds: new Set([eligibility.id]), unsupportedClaims: [] });

const scopedNegation = "Not all refunds are available within 30 days for unopened items.";
expect(matchReferenceFacts([eligibility], [{ text: scopedNegation, isQuestion: false }]))
  .toMatchObject({ supportedFactIds: new Set(), unsupportedClaims: [] });

const unrelatedNumber = "Refunds are available within 30 days for unopened items, the support team checks the order in 2 minutes.";
expect(matchReferenceFacts([eligibility], [{ text: unrelatedNumber, isQuestion: false }]))
  .toMatchObject({ supportedFactIds: new Set([eligibility.id]), unsupportedClaims: [] });
```

Use direct `Set` membership assertions if Vitest object matching does not compare sets clearly. The `not all` case must be missed rather than unsupported because it is not an unambiguous universal negative statement.

- [ ] **Step 2: Run the focused test file and verify RED.**

Run: `npm test -- src/evaluation/structured-fact-matcher.test.ts`

Expected: the four new regressions fail for the documented current outcomes, while pre-existing tests may pass.

- [ ] **Step 3: Implement relation-anchored spans.**

Replace generic `clauseSegments` and grammar-based comma splitting with helpers that operate on one fact specification at a time:

```ts
type EvidenceSpan = { tokens: string[]; originalText: string; isQuestion: boolean };

const relationAnchoredSpans = (
  spec: FactMatchSpec,
  allSpecs: FactMatchSpec[],
  statement: { text: string; isQuestion: boolean },
): EvidenceSpan[] => {
  // Normalize the statement.
  // For each occurrence of a relation term belonging to spec, retain the nearby
  // subject-to-relation-to-value/condition sequence.
  // Stop at punctuation, contrast markers, or a new relation anchor owned by a
  // different fact. Do not infer general English independent clauses.
};
```

Use this boundary policy:

1. Relation anchors from another compiled fact end the current span, preserving same-subject facts in a coordinated answer.
2. A value conflicts only when it is inside the same relation span as the fact’s relation. Numbers after an unrelated clause are ignored.
3. Negation is a contradiction only when it scopes the anchored subject/relation phrase. `not all` prevents affirmative credit but is ambiguous unless another direct conflict exists.
4. A universal phrase conflicts only when it explicitly replaces a required condition’s head term: `all items` conflicts with required `unopened items`; `all unopened items` preserves that condition; unrelated `regardless of payment method` does not remove it.
5. Missing required evidence produces a missed fact, not an unsupported claim.

Keep conservative required-term matching only for facts with no relation terms. Preserve contractions, conjunction-required subjects, question exclusion, and statement-level de-duplication.

- [ ] **Step 4: Run the focused matcher suite and verify GREEN.**

Run: `npm test -- src/evaluation/structured-fact-matcher.test.ts`

Expected: all existing tests plus the four new regressions pass. In particular, correct coordinated same-subject facts must still both receive credit, reversed values remain unsupported, and partial claims remain missed.

- [ ] **Step 5: Update project diary and write the task report.**

Update `BUGS.md` to record that the Task 6 matching limitation is resolved only after this task’s independent review clears. Add an `[Unreleased]` `Fixed` entry to `CHANGELOG.md` that explains the matcher now isolates evidence by relation. Update `ENHANCEMENTS.md` only to record that this is a correction to approved evaluation behavior, not a new backlog item.

Write `.superpowers/sdd/relation-anchored-matcher-task-1-report.md` with RED and GREEN output, typecheck, full-suite/build results, secret-scan result, changed files, and limitations. Do not claim evaluator integration is complete.

- [ ] **Step 6: Run verification, self-review, and commit.**

Run:

```bash
npm test -- src/evaluation/structured-fact-matcher.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Run the existing repository secret scan documented in prior matcher reports. Inspect the staged diff for scope. Commit only the files listed for this task with:

```bash
git commit -m "fix: anchor factual evidence to relations"
```

**Acceptance checks:**

- The four diagnostic reproductions pass with the exact outcomes above.
- Existing 35 matcher cases remain green.
- No evaluator import or integration is added.
- No dependency or public-contract change occurs.
- A fresh independent review reports no Critical or Important matcher correctness issue.

