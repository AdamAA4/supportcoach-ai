import type { ReferenceFact } from "../domain/reference-source";

type FactMatchSpec = {
  subjectTerms: string[];
  relationTerms: string[];
  valueTerms: string[];
  conditionTerms: string[];
  requiredTerms: string[];
};

export type FactualMatchResult = {
  supportedFactIds: Set<string>;
  unsupportedClaims: string[];
};

type EvidenceSpan = {
  tokens: string[];
  originalText: string;
  isQuestion: boolean;
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
const OPPOSITE_PAIRS = [
  ["unopened", "opened"],
  ["before", "after"],
  ["within", "outside"],
  ["eligible", "ineligible"],
  ["available", "unavailable"],
] as const;
const NEGATORS = new Set(["not", "never", "no", "cannot", "cant"]);

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

const unique = <T>(values: T[]): T[] => [...new Set(values)];
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
    const conditions = unique(tokens.filter((term) => CONDITION_WORDS.has(term) || NEGATORS.has(term)));
    const required = unique(tokens.filter((term) => !FUNCTION_WORDS.has(term)));
    return [fact.id, {
      subjectTerms: subjects,
      relationTerms: relations,
      valueTerms: values,
      conditionTerms: conditions,
      requiredTerms: required,
    }];
  }));
};

const positionsOf = (tokens: string[], terms: string[]): number[] =>
  terms.flatMap((term) => tokens.flatMap((token, index) => token === term ? [index] : []));

const relationAnchoredSpans = (
  spec: FactMatchSpec,
  allSpecs: FactMatchSpec[],
  statement: { text: string; isQuestion: boolean },
): EvidenceSpan[] => {
  if (spec.relationTerms.length === 0) {
    return [{ ...statement, originalText: statement.text, tokens: normalizeFactTokens(statement.text) }];
  }

  const differentRelations = unique(allSpecs.flatMap((candidate) => candidate.relationTerms))
    .filter((term) => !spec.relationTerms.includes(term));

  // Punctuation is an evidence boundary, not an attempt to parse independent
  // English clauses. Never split bare conjunctions: they can belong to subjects.
  return statement.text.split(/[,.!?;:]+|\b(?:but|while|however)\b/i).flatMap((segment) => {
    const tokens = normalizeFactTokens(segment);
    const ownAnchors = unique(positionsOf(tokens, spec.relationTerms))
      .sort((left, right) => left - right);
    // Another fact's relation anchor may also be this fact's subject term
    // (e.g. "delivery" across delivery facts): such positions must not cut
    // this fact's evidence window in front of its own subject.
    const subjectTermAt = (position: number): boolean =>
      spec.subjectTerms.includes(tokens[position]);

    return ownAnchors.map((anchor) => {
      const previousDifferentAnchor = positionsOf(tokens, differentRelations)
        .filter((position) => position < anchor && !subjectTermAt(position))
        .sort((left, right) => right - left)[0] ?? -1;
      const nextDifferentAnchor = positionsOf(tokens, differentRelations)
        .filter((position) => position > anchor && !subjectTermAt(position))
        .sort((left, right) => left - right)[0] ?? tokens.length;
      const subjectPositions = positionsOf(
        tokens.slice(previousDifferentAnchor + 1, anchor + 1),
        spec.subjectTerms,
      ).map((position) => position + previousDifferentAnchor + 1);
      const hasEverySubject = spec.subjectTerms.every((term) =>
        tokens.slice(previousDifferentAnchor + 1, anchor + 1).includes(term),
      );
      const subjectStart = subjectPositions.length === 0
        ? previousDifferentAnchor + 1
        : hasEverySubject
          ? Math.min(...subjectPositions)
          : Math.max(...subjectPositions);
      const leadingNegators = positionsOf(
        tokens.slice(previousDifferentAnchor + 1, subjectStart),
        [...NEGATORS],
      );
      const leadingNegator = leadingNegators.length === 0 ? -1 : Math.max(...leadingNegators);
      const start = leadingNegator === -1
        ? subjectStart
        : previousDifferentAnchor + 1 + leadingNegator;

      return {
        tokens: tokens.slice(start, nextDifferentAnchor),
        originalText: statement.text,
        isQuestion: statement.isQuestion,
      };
    });
  });
};

const hasScopedNegation = (tokens: string[], spec: FactMatchSpec): boolean =>
  tokens.some((token, index) => {
    if (!NEGATORS.has(token)) return false;
    if (token === "not" && tokens[index + 1] === "all") return false;
    const firstSubject = tokens.findIndex((candidate) => spec.subjectTerms.includes(candidate));
    const leadsSubject = firstSubject > index;
    return leadsSubject || tokens.slice(index + 1, index + 5).some((candidate) =>
      spec.relationTerms.includes(candidate) || spec.conditionTerms.includes(candidate),
    );
  });

const hasRemovedCondition = (tokens: string[], spec: FactMatchSpec): boolean =>
  spec.conditionTerms.some((condition) => {
    // Required terms preserve source order. A condition followed by a lexical
    // head ("unopened items") can be explicitly replaced by "all items".
    // Temporal bounds such as "within 30 days" are not noun restrictions.
    const head = spec.requiredTerms[spec.requiredTerms.indexOf(condition) + 1];
    if (!head || /^\d+$/.test(head) || CONDITION_WORDS.has(head) ||
      VALUE_UNITS.has(head) || NEGATORS.has(condition)) return false;

    return tokens.some((token, index) => {
      if (token !== "all" || tokens[index - 1] === "not") return false;
      const headOffset = tokens.slice(index + 1).indexOf(head);
      if (headOffset === -1) return false;
      const modifiers = tokens.slice(index + 1, index + 1 + headOffset);
      return !modifiers.includes(condition) && modifiers.every((term) =>
        !FUNCTION_WORDS.has(term) && !NEGATORS.has(term) && !/^\d+$/.test(term),
      );
    });
  });

const assessSpan = (
  spec: FactMatchSpec,
  window: EvidenceSpan,
): { supported: boolean; conflict: boolean } => {
  if (window.isQuestion) return { supported: false, conflict: false };

  const subjectRelevant = spec.subjectTerms.every((term) => window.tokens.includes(term));
  const relationRelevant = spec.relationTerms.length === 0 ||
    spec.relationTerms.some((term) => window.tokens.includes(term));
  const relevant = subjectRelevant && relationRelevant;
  if (!relevant) return { supported: false, conflict: false };

  const expectedNumbers = spec.valueTerms.filter((term) => /^\d+$/.test(term));
  const actualNumbers = window.tokens.filter((term) => /^\d+$/.test(term));
  const containsExpectedNumber = expectedNumbers.some((term) => actualNumbers.includes(term));
  const containsDifferentNumber = actualNumbers.some((term) => !expectedNumbers.includes(term));
  const ambiguousFallbackValues = spec.relationTerms.length === 0 &&
    containsExpectedNumber && containsDifferentNumber;
  const conflictingNumber = !ambiguousFallbackValues && expectedNumbers.length > 0 &&
    actualNumbers.length > 0 &&
    actualNumbers.some((term) => !expectedNumbers.includes(term));
  const oppositeCondition = OPPOSITE_PAIRS.some(([expected, opposite]) =>
    (spec.requiredTerms.includes(expected) && window.tokens.includes(opposite)) ||
    (spec.requiredTerms.includes(opposite) && window.tokens.includes(expected)),
  );
  const removedCondition = hasRemovedCondition(window.tokens, spec);
  const ambiguousNegation = window.tokens.some((token, index) =>
    token === "not" && window.tokens[index + 1] === "all",
  );
  const expectsNegation = spec.requiredTerms.some((term) => NEGATORS.has(term));
  const unexpectedNegation = !expectsNegation && hasScopedNegation(window.tokens, spec);
  const removedNegation = expectsNegation &&
    !window.tokens.some((term) => NEGATORS.has(term)) &&
    spec.requiredTerms
      .filter((term) => !NEGATORS.has(term))
      .every((term) => window.tokens.includes(term));
  const conflict = conflictingNumber || oppositeCondition || removedCondition ||
    unexpectedNegation || removedNegation;
  const supported = !conflict && !ambiguousFallbackValues && !ambiguousNegation &&
    spec.requiredTerms.every((term) => window.tokens.includes(term));

  return { supported, conflict };
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
      for (const window of relationAnchoredSpans(spec, allSpecs, statement)) {
        const result = assessSpan(spec, window);
        if (result.supported) supportedFactIds.add(fact.id);
        if (result.conflict) unsupportedClaims.add(statement.text);
      }
    }
  }

  return { supportedFactIds, unsupportedClaims: [...unsupportedClaims] };
};
