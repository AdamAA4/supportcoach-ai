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
