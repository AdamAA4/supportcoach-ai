# Structured Fact Matcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the evaluator's shared lexical topic-boundary heuristic with an internal structured matcher that assesses each confirmed FAQ fact independently, including coordinated same-subject facts.

**Architecture:** Add one evaluation-layer module that compiles existing `ReferenceFact` values into private `FactMatchSpec` records, segments trainee sentences around discriminating relation/value anchors, and returns supported fact IDs plus explicit conflict evidence. `DeterministicEvaluator` keeps score, strengths, exercise, transcript, and provenance ownership while delegating factual matching to this module. No API, storage, domain, import, UI, or dependency contract changes.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.9, Vitest 4, existing Node/Next build and lint tooling; no new dependency or external model.

## Global Constraints

- Keep the existing Next.js, React, TypeScript, Tailwind, Vitest, and Playwright stack.
- Add no runtime dependency or external AI/model call.
- Preserve the public `ReferenceFact`, `Evaluator`, `CoachingReport`, API, and persisted-data contracts.
- Score only trainee turns against confirmed normalized FAQ/reference facts.
- Personal coaching notes may influence the next exercise but never factual credit.
- Prefer a missed fact when evidence is ambiguous. Report an unsupported claim only when the trainee states an identifiable conflicting value or condition.
- Do not add scenario-specific refund, delivery, or exchange rules.
- Keep `FactMatchSpec` internal to `src/evaluation/structured-fact-matcher.ts` with exactly `subjectTerms`, `relationTerms`, `valueTerms`, `conditionTerms`, and `requiredTerms`.
- Do not persist, expose, or log compiled matcher data, source content, notes, or transcripts.
- Use GPT-5.6 Sol with high reasoning for implementation and GPT-6 Astra with high reasoning for the independent review.

---

## File Map

- Create `src/evaluation/structured-fact-matcher.ts`: token normalization, fact compilation, claim windows, fact-local support/conflict assessment, and the single internal matching result.
- Create `src/evaluation/structured-fact-matcher.test.ts`: focused compiler, segmentation, ambiguity, same-subject, conjunction, negation, and conflicting-value tests.
- Modify `src/evaluation/deterministic-evaluator.ts`: remove `claimsForFact` and factual `assess` ownership; delegate factual matching to the structured matcher; retain non-factual coaching scores and report assembly.
- Modify `src/evaluation/evaluator.test.ts`: retain the existing evaluator contract suite and add end-to-end regressions proving the integrated report behavior.
- Modify `.superpowers/sdd/task-6-report.md`: append RED/GREEN evidence, architectural decision, verification results, and limitations.
- Modify `CHANGELOG.md`, `ENHANCEMENTS.md`, and `BUGS.md`: record the implemented matcher; archive the open evaluator bug only after independent review passes.

### Task 1: Compile facts into stable internal match specifications

**Files:**
- Create: `src/evaluation/structured-fact-matcher.ts`
- Create: `src/evaluation/structured-fact-matcher.test.ts`

**Interfaces:**
- Consumes: `ReferenceFact` from `src/domain/reference-source.ts`.
- Produces: `compileFactMatchSpecs(facts: ReferenceFact[]): Map<string, FactMatchSpec>` for Task 2 in the same internal module.
- Internal type:

```ts
type FactMatchSpec = {
  subjectTerms: string[];
  relationTerms: string[];
  valueTerms: string[];
  conditionTerms: string[];
  requiredTerms: string[];
};
```

- [ ] **Step 1: Write compiler tests before production code**

Create `src/evaluation/structured-fact-matcher.test.ts` with fixtures and assertions that establish the internal structure without exporting it outside the evaluation module:

```ts
import { describe, expect, it } from "vitest";
import type { ReferenceFact } from "../domain/reference-source";
import { compileFactMatchSpecs } from "./structured-fact-matcher";

const fact = (id: string, answer: string, keywords: string[] = []): ReferenceFact => ({
  id,
  question: `${id}?`,
  answer,
  keywords,
  source: "policy",
});

describe("compileFactMatchSpecs", () => {
  it("separates shared subjects from discriminating relations and values", () => {
    const specs = compileFactMatchSpecs([
      fact("eligibility", "Refunds are available within 30 days for unopened items"),
      fact("processing", "Refunds are processed within 5 business days"),
    ]);

    expect(specs.get("eligibility")).toEqual({
      subjectTerms: ["refunds"],
      relationTerms: ["available", "items"],
      valueTerms: ["30", "days"],
      conditionTerms: ["within", "unopened"],
      requiredTerms: ["refunds", "available", "within", "30", "days", "unopened", "items"],
    });
    expect(specs.get("processing")).toEqual({
      subjectTerms: ["refunds"],
      relationTerms: ["processed"],
      valueTerms: ["5", "business", "days"],
      conditionTerms: ["within"],
      requiredTerms: ["refunds", "processed", "within", "5", "business", "days"],
    });
  });

  it("retains a conjunction-required subject and returns a conservative fallback", () => {
    const specs = compileFactMatchSpecs([
      fact("combined", "Refunds and exchanges are processed within 5 days"),
      fact("exchange", "Exchanges are processed within 5 days"),
      fact("availability", "Exchanges are available within 30 days"),
    ]);

    expect(specs.get("combined")?.requiredTerms).toEqual([
      "refunds", "exchanges", "processed", "within", "5", "days",
    ]);
    expect(specs.get("combined")?.subjectTerms).toEqual(["refunds", "exchanges"]);
    expect(specs.get("availability")?.relationTerms).toContain("available");
  });
});
```

- [ ] **Step 2: Run the compiler tests and observe RED**

Run:

```bash
npx vitest run src/evaluation/structured-fact-matcher.test.ts
```

Expected: FAIL because `structured-fact-matcher.ts` and `compileFactMatchSpecs` do not exist.

- [ ] **Step 3: Implement deterministic token normalization and compilation**

Create `src/evaluation/structured-fact-matcher.ts` with the exact internal type and these responsibilities:

```ts
import type { ReferenceFact } from "../domain/reference-source";

type FactMatchSpec = {
  subjectTerms: string[];
  relationTerms: string[];
  valueTerms: string[];
  conditionTerms: string[];
  requiredTerms: string[];
};

const FUNCTION_WORDS = new Set([
  "a", "an", "the", "is", "are", "be", "can", "will", "for", "to", "of",
  "in", "on", "and", "or", "when", "what", "where", "how", "my", "your", "with",
]);
const CONDITION_WORDS = new Set([
  "within", "before", "after", "unless", "until", "only", "if", "unopened", "opened",
  "under", "over", "minimum", "maximum", "least",
]);
const VALUE_UNITS = new Set([
  "minute", "minutes", "hour", "hours", "day", "days", "week", "weeks", "month", "months",
  "year", "years", "percent", "percentage", "business",
]);

export const normalizeFactTokens = (text: string): string[] =>
  text.toLowerCase()
    .replace(/\bisn[’']t\b/g, "is not")
    .replace(/\baren[’']t\b/g, "are not")
    .replace(/\bwasn[’']t\b/g, "was not")
    .replace(/\bweren[’']t\b/g, "were not")
    .replace(/\bdon[’']t\b/g, "do not")
    .replace(/\bdoesn[’']t\b/g, "does not")
    .replace(/\bwon[’']t\b/g, "will not")
    .replace(/\bcan[’']t\b/g, "cannot")
    .match(/[a-z0-9]+/g) ?? [];

const unique = (values: string[]): string[] => [...new Set(values)];
const contentTerms = (tokens: string[]): string[] =>
  unique(tokens.filter((token) => !FUNCTION_WORDS.has(token) && token !== "not"));

const valueTerms = (tokens: string[]): string[] => {
  const values = new Set<string>();
  tokens.forEach((token, index) => {
    if (!/^\d+$/.test(token)) return;
    values.add(token);
    for (let offset = 1; offset <= 2; offset += 1) {
      const next = tokens[index + offset];
      if (next && VALUE_UNITS.has(next)) values.add(next);
    }
  });
  return [...values];
};

export const compileFactMatchSpecs = (facts: ReferenceFact[]): Map<string, FactMatchSpec> => {
  const prepared = facts.map((fact) => {
    const tokens = normalizeFactTokens(fact.answer);
    return { fact, tokens, content: contentTerms(tokens), values: valueTerms(tokens) };
  });
  const termFacts = new Map<string, Set<string>>();
  prepared.forEach(({ fact, content }) => content.forEach((term) => {
    const owners = termFacts.get(term) ?? new Set<string>();
    owners.add(fact.id);
    termFacts.set(term, owners);
  }));

  return new Map(prepared.map(({ fact, tokens, content, values }) => {
    const firstDiscriminator = content.findIndex((term, index) =>
      index > 0 && (termFacts.get(term)?.size ?? 0) === 1,
    );
    const subjectEnd = firstDiscriminator === -1 ? Math.min(2, content.length) : firstDiscriminator;
    const subjects = content.slice(0, Math.max(1, subjectEnd));
    const relations = content.filter((term, index) =>
      index >= Math.max(1, subjectEnd) && !values.includes(term) && !CONDITION_WORDS.has(term),
    );
    const conditions = unique(tokens.filter((term) => CONDITION_WORDS.has(term)));
    const required = unique(tokens.filter((term) => !FUNCTION_WORDS.has(term) && term !== "not"));
    return [fact.id, {
      subjectTerms: subjects,
      relationTerms: relations,
      valueTerms: values,
      conditionTerms: conditions,
      requiredTerms: required,
    }];
  }));
};
```

Do not add scenario words or mutate `ReferenceFact`. Any classification change requires a failing compiler test before the production edit.

- [ ] **Step 4: Run the compiler tests and make them GREEN**

Run:

```bash
npx vitest run src/evaluation/structured-fact-matcher.test.ts
```

Expected: PASS for the compiler tests with no TypeScript diagnostics.

- [ ] **Step 5: Commit the compiler slice**

```bash
git add src/evaluation/structured-fact-matcher.ts src/evaluation/structured-fact-matcher.test.ts
git commit -m "feat: compile structured fact match specifications"
```

### Task 2: Match coordinated claims fact by fact

**Files:**
- Modify: `src/evaluation/structured-fact-matcher.ts`
- Modify: `src/evaluation/structured-fact-matcher.test.ts`

**Interfaces:**
- Consumes: `ReferenceFact[]` and trainee statements with their original text.
- Produces:

```ts
export type FactualMatchResult = {
  supportedFactIds: Set<string>;
  unsupportedClaims: string[];
};

export const matchReferenceFacts = (
  facts: ReferenceFact[],
  statements: Array<{ text: string; isQuestion: boolean }>,
): FactualMatchResult;
```

- [ ] **Step 1: Add RED tests for support, conflict, ambiguity, and conjunctions**

Append tests that call `matchReferenceFacts` directly. Use the exact two refund facts and assert both input orders:

```ts
describe("matchReferenceFacts", () => {
  const eligibility = fact("eligibility", "Refunds are available within 30 days for unopened items");
  const processing = fact("processing", "Refunds are processed within 5 business days");

  it.each([
    "Refunds are available within 30 days for unopened items and refunds are processed within 5 business days.",
    "Refunds are processed within 5 business days and refunds are available within 30 days for unopened items.",
  ])("supports two correct same-subject claims: %s", (text) => {
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect([...result.supportedFactIds]).toEqual(expect.arrayContaining([eligibility.id, processing.id]));
    expect(result.unsupportedClaims).toEqual([]);
  });

  it.each([
    "Refunds are available within 30 days for unopened items and refunds are processed within 15 business days.",
    "Refunds are processed within 15 business days and refunds are available within 30 days for unopened items.",
  ])("credits the correct claim and flags only the conflicting claim: %s", (text) => {
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.supportedFactIds.has(processing.id)).toBe(false);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it("preserves a conjunction required by one fact", () => {
    const combined = fact("combined", "Refunds and exchanges are processed within 5 days");
    const exchange = fact("exchange", "Exchanges are processed within 5 days");
    const availability = fact("availability", "Exchanges are available within 30 days");
    const text = combined.answer;
    const result = matchReferenceFacts([combined, exchange, availability], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(combined.id)).toBe(true);
    expect(result.supportedFactIds.has(availability.id)).toBe(false);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("treats an incomplete relevant statement as missed without inventing a conflict", () => {
    const text = "Refunds are available.";
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([]);
  });
});
```

Also port focused boundaries from `evaluator.test.ts`: negative contractions, opposite opened/unopened condition, unconditional promises, extra numbers, questions, and unrelated reassurance.

- [ ] **Step 2: Run the matcher tests and observe RED**

Run:

```bash
npx vitest run src/evaluation/structured-fact-matcher.test.ts
```

Expected: compiler tests pass; matcher tests FAIL because `matchReferenceFacts` is not implemented.

- [ ] **Step 3: Implement claim windows and fact-local assessment**

Extend `structured-fact-matcher.ts`. Keep all helpers private except `compileFactMatchSpecs`, `normalizeFactTokens`, and `matchReferenceFacts` used by tests/evaluator.

The implementation must follow these exact decision rules:

```ts
export type FactualMatchResult = {
  supportedFactIds: Set<string>;
  unsupportedClaims: string[];
};

// 1. Normalize each statement and preserve its original text.
// 2. Build relation-anchor positions from every compiled spec.
// 3. A claim window begins at the nearest preceding subject term and ends
//    immediately before the next different relation anchor.
// 4. Do not split on "and" alone.
// 5. For a spec without a discriminating relation anchor, use the full
//    statement as a conservative candidate.
// 6. A fact is supported only when one candidate contains every required term
//    and has no fact-local conflict.
// 7. A fact-local conflict requires subject/relation relevance plus an explicit
//    mismatched numeric value, opposite condition, scoped negation, or removed
//    eligibility condition.
// 8. Extra values outside that fact's claim window cannot create a conflict.
// 9. Questions and ambiguous/incomplete claims cannot support or conflict.
// 10. Deduplicate unsupported evidence by original statement text.
```

Implement these named helpers so each rule can be tested and reviewed:

```ts
type TokenWindow = { tokens: string[]; originalText: string; isQuestion: boolean };

const OPPOSITE_PAIRS = [
  ["unopened", "opened"], ["before", "after"], ["within", "outside"],
  ["eligible", "ineligible"], ["available", "unavailable"],
] as const;
const NEGATORS = new Set(["not", "never", "no", "cannot", "cant"]);

const positionsOf = (tokens: string[], terms: string[]): number[] =>
  terms.flatMap((term) => tokens.flatMap((token, index) => token === term ? [index] : []));

const claimWindowsFor = (
  spec: FactMatchSpec,
  allSpecs: FactMatchSpec[],
  statement: { text: string; isQuestion: boolean },
): TokenWindow[] => {
  const tokens = normalizeFactTokens(statement.text);
  const allRelations = [...new Set(allSpecs.flatMap((candidate) => candidate.relationTerms))];
  const allSubjects = new Set(allSpecs.flatMap((candidate) => candidate.subjectTerms));
  const anchors = [...new Set(positionsOf(tokens, allRelations))].sort((left, right) => left - right);
  const ownAnchors = [...new Set(positionsOf(tokens, spec.relationTerms))].sort((left, right) => left - right);

  if (ownAnchors.length === 0) {
    return [{ tokens, originalText: statement.text, isQuestion: statement.isQuestion }];
  }

  return ownAnchors.map((anchor) => {
    const previousAnchor = [...anchors].reverse().find((position) => position < anchor) ?? -1;
    const nextAnchor = anchors.find((position) => position > anchor) ?? tokens.length;
    let start = previousAnchor + 1;
    for (let index = anchor; index >= previousAnchor + 1; index -= 1) {
      if (spec.subjectTerms.includes(tokens[index])) {
        start = index;
      }
    }
    let end = nextAnchor;
    for (let index = anchor + 1; index < nextAnchor; index += 1) {
      if (allSubjects.has(tokens[index])) {
        end = index;
        break;
      }
    }
    return {
      tokens: tokens.slice(start, end),
      originalText: statement.text,
      isQuestion: statement.isQuestion,
    };
  });
};

const hasScopedNegation = (tokens: string[], spec: FactMatchSpec): boolean =>
  tokens.some((token, index) => NEGATORS.has(token) &&
    tokens.slice(index + 1, index + 5).some((candidate) =>
      spec.relationTerms.includes(candidate) || spec.conditionTerms.includes(candidate),
    ));

const assessWindow = (
  spec: FactMatchSpec,
  window: TokenWindow,
): { supported: boolean; conflict: boolean } => {
  if (window.isQuestion) return { supported: false, conflict: false };
  const subjectRelevant = spec.subjectTerms.some((term) => window.tokens.includes(term));
  const relationRelevant = spec.relationTerms.length === 0 ||
    spec.relationTerms.some((term) => window.tokens.includes(term));
  const relevant = subjectRelevant && relationRelevant;
  const supported = relevant && spec.requiredTerms.every((term) => window.tokens.includes(term));
  if (supported) return { supported: true, conflict: false };

  const expectedNumbers = spec.valueTerms.filter((term) => /^\d+$/.test(term));
  const actualNumbers = window.tokens.filter((term) => /^\d+$/.test(term));
  const conflictingNumber = expectedNumbers.length > 0 && actualNumbers.length > 0 &&
    actualNumbers.some((term) => !expectedNumbers.includes(term));
  const oppositeCondition = OPPOSITE_PAIRS.some(([expected, opposite]) =>
    (spec.requiredTerms.includes(expected) && window.tokens.includes(opposite)) ||
    (spec.requiredTerms.includes(opposite) && window.tokens.includes(expected)),
  );
  const removedCondition = spec.conditionTerms.length > 0 &&
    window.tokens.some((term) => ["always", "regardless", "all"].includes(term));
  const conflict = relevant &&
    (conflictingNumber || oppositeCondition || removedCondition || hasScopedNegation(window.tokens, spec));
  return { supported: false, conflict };
};

export const matchReferenceFacts = (
  facts: ReferenceFact[],
  statements: Array<{ text: string; isQuestion: boolean }>,
): FactualMatchResult => {
  const specs = compileFactMatchSpecs(facts);
  const allSpecs = [...specs.values()];
  const supportedFactIds = new Set<string>();
  const unsupportedClaims = new Set<string>();

  for (const fact of facts) {
    const spec = specs.get(fact.id);
    if (!spec) continue;
    for (const statement of statements) {
      for (const window of claimWindowsFor(spec, allSpecs, statement)) {
        const result = assessWindow(spec, window);
        if (result.supported) supportedFactIds.add(fact.id);
        if (result.conflict) unsupportedClaims.add(statement.text);
      }
    }
  }

  return { supportedFactIds, unsupportedClaims: [...unsupportedClaims] };
};
```

If a new boundary is discovered, add a failing test that expresses the conservative behavior before changing production code. Do not introduce a fourth ad hoc topic-boundary heuristic.

- [ ] **Step 4: Run the focused matcher suite and make it GREEN**

Run:

```bash
npx vitest run src/evaluation/structured-fact-matcher.test.ts
```

Expected: all compiler and matcher cases PASS, including both-order same-subject cases and the required-conjunction case.

- [ ] **Step 5: Run adversarial focused checks before committing**

Add and run table tests for:

- Same subject and same relation with different values.
- Same subject with one correct fact and two conflicting values.
- Two facts in separate sentences.
- A correct claim followed by unrelated negative reassurance.
- A fact with no usable unique relation term.
- Duplicate/subset facts where one answer entails another.

Run:

```bash
npx vitest run src/evaluation/structured-fact-matcher.test.ts
```

Expected: all cases PASS. A case the deterministic matcher cannot identify must remain missed with no unsupported claim.

- [ ] **Step 6: Commit the matcher behavior**

```bash
git add src/evaluation/structured-fact-matcher.ts src/evaluation/structured-fact-matcher.test.ts
git commit -m "feat: match confirmed facts independently"
```

### Task 3: Integrate the matcher into coaching evaluation and close Task 6

**Files:**
- Modify: `src/evaluation/deterministic-evaluator.ts`
- Modify: `src/evaluation/evaluator.test.ts`
- Modify: `.superpowers/sdd/task-6-report.md`
- Modify: `CHANGELOG.md`
- Modify: `ENHANCEMENTS.md`
- Modify: `BUGS.md`

**Interfaces:**
- Consumes: `matchReferenceFacts(facts, statements): FactualMatchResult` from Task 2.
- Preserves: `Evaluator.evaluate(...)`, `CoachingReport`, route envelopes, persisted report shape, and UI behavior.

- [ ] **Step 1: Add integrated evaluator regressions and observe RED**

Append evaluator tests for the same-subject cases using the real `DeterministicEvaluator`:

```ts
it("scores two correct same-subject facts in one sentence", async () => {
  const eligibility = { ...context.facts[0], id: "eligibility", answer: "Refunds are available within 30 days for unopened items" };
  const processing = { ...context.facts[0], id: "processing", answer: "Refunds are processed within 5 business days" };
  const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
    ...context,
    facts: [eligibility, processing],
    scenario: { ...context.scenario, factIds: [eligibility.id, processing.id] },
    transcript: [turn("Refunds are available within 30 days for unopened items and refunds are processed within 5 business days.")],
  });
  expect(report.scores.factualAccuracy).toBe(3);
  expect(report.missedFacts).toEqual([]);
  expect(report.unsupportedClaims).toEqual([]);
});

it("credits one same-subject fact and reports the conflicting one", async () => {
  const eligibility = { ...context.facts[0], id: "eligibility", answer: "Refunds are available within 30 days for unopened items" };
  const processing = { ...context.facts[0], id: "processing", answer: "Refunds are processed within 5 business days" };
  const text = "Refunds are available within 30 days for unopened items and refunds are processed within 15 business days.";
  const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
    ...context,
    facts: [eligibility, processing],
    scenario: { ...context.scenario, factIds: [eligibility.id, processing.id] },
    transcript: [turn(text)],
  });
  expect(report.missedFacts).toEqual([processing.answer]);
  expect(report.unsupportedClaims).toEqual([text]);
});
```

Run:

```bash
npx vitest run src/evaluation/evaluator.test.ts
```

Expected: the new integrated tests FAIL against the current topic-boundary evaluator.

- [ ] **Step 2: Replace factual matching inside `DeterministicEvaluator`**

In `src/evaluation/deterministic-evaluator.ts`:

- Import `matchReferenceFacts`.
- Retain sentence extraction for empathy, clarity, and resolution.
- Delete `factualClauses`, `oppositePairs`, `commonWords`, `negators`, `negationFillers`, `factNegated`, `claimsForFact`, and `assess` after equivalent behavior is covered in the matcher module.
- Build statements only from trainee turns:

```ts
const factual = matchReferenceFacts(
  referenceFacts,
  traineeSentences.map((text) => ({ text, isQuestion: text.endsWith("?") })),
);
const missedFacts = referenceFacts
  .filter((fact) => !factual.supportedFactIds.has(fact.id))
  .map((fact) => fact.answer);
const unsupportedClaims = factual.unsupportedClaims;
```

- Keep the existing factual score formula, honest strength wording, next exercise, full transcript copy, and frozen source provenance unchanged.

- [ ] **Step 3: Run integrated and focused tests**

Run:

```bash
npx vitest run src/evaluation/structured-fact-matcher.test.ts src/evaluation/evaluator.test.ts src/app/api/evaluate/route.test.ts
```

Expected: all matcher, evaluator, and API route tests PASS. No customer/system turn may earn factual credit, and notes must remain excluded from factual scoring.

- [ ] **Step 4: Update durable documentation without closing the bug prematurely**

Append to `.superpowers/sdd/task-6-report.md`:

- The approved design and plan paths.
- RED output for compiler, matcher, and evaluator tests.
- GREEN output and adversarial cases.
- The exact file boundary and unchanged public contracts.
- Known deterministic paraphrase limitation.

Update `CHANGELOG.md` under `[Unreleased] / Changed` or `Fixed` to state that factual evaluation now uses fact-local structured matching. Update `ENHANCEMENTS.md` without changing priority order. Keep the Task 6 issue open in `BUGS.md` until the independent review approves the implementation.

- [ ] **Step 5: Run the full verification gates**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
node .superpowers/sdd/task-5-secret-scan.cjs
```

Expected:

- Lint exits 0 with no ESLint error.
- TypeScript exits 0 with no diagnostics.
- Every test passes.
- Production build completes and generates all routes.
- Diff check has no whitespace errors.
- Secret scan reports zero credential, browser server-key/canary, or tracked private-environment findings.

- [ ] **Step 6: Perform focused self-review**

Inspect the staged diff and confirm:

- No changes to `package.json`, the lockfile, public domain types, API envelopes, persistence keys, or voice code.
- No source, note, transcript, or compiled-spec logging.
- No scenario-specific words inside production matching rules.
- Matcher ambiguity produces missed facts rather than unsupported claims.
- Report transcript and provenance behavior remain unchanged.

- [ ] **Step 7: Commit implementation and evidence**

```bash
git add src/evaluation/structured-fact-matcher.ts src/evaluation/structured-fact-matcher.test.ts src/evaluation/deterministic-evaluator.ts src/evaluation/evaluator.test.ts CHANGELOG.md ENHANCEMENTS.md BUGS.md
git add -f .superpowers/sdd/task-6-report.md
git commit -m "fix: use structured factual matching"
```

- [ ] **Step 8: Run the independent Task 6 review gate**

Generate a review package from the review-approved Task 5 base `106aa22` through the new Task 6 head. Use GPT-6 Astra with high reasoning. The reviewer must verify spec compliance, same-subject facts, conjunction-required facts, conservative ambiguity, preserved contracts, tests, logging, dependencies, and documentation.

If the reviewer returns any Critical or Important finding, dispatch one focused fix agent with the complete findings list, require focused RED/GREEN evidence and the relevant full gates, then re-review. Only after approval:

- Archive the Task 6 issue in `BUGS.md`.
- Append `Task 6: complete (commits 106aa22..<head>, review clean)` to `.superpowers/sdd/progress.md`.
- Continue to Task 7 of the main SupportCoach implementation plan.
