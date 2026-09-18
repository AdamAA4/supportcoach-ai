import type { ReferenceFact } from "./reference-source";
import type { ScenarioDefinition } from "./practice-pack";

// Content-derived practice scenarios: each substantive FAQ section becomes a
// suggested drill (persona, opening line, and the section's confirmed facts),
// so any imported FAQ yields practice relevant to its own domain. Derivation
// is a pure function of the fact list: identical facts always produce
// identical scenario ids and definitions, which the session-validation
// round-trip (equalData against normalizePracticeContext) depends on.

export const MAX_DERIVED_SCENARIOS = 6;

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "can", "am", "i", "my", "me",
  "to", "for", "of", "in", "on", "with", "and", "or", "how", "what", "when",
  "where", "why", "your", "you", "it", "its", "if", "there",
]);

// Sections that are site furniture rather than practice material.
const NON_TOPIC_HEADINGS = /^(contact( us)?|about( us)?|home|follow us|newsletter|careers|jobs?|blog|news|press|menu|navigation|search|sign in|log ?in|sign up|register|privacy( policy)?|terms( of (use|service))?|get in touch|reach us|home page)\??$/i;

const wordsOf = (value: string): string[] => value.toLowerCase().match(/[a-z0-9']+/g) ?? [];

const contentWords = (value: string): string[] =>
  [...new Set(wordsOf(value).filter((word) => word.length > 2 && !STOP_WORDS.has(word)))];

const hashOf = (value: string): string => {
  let hash = 5381;
  for (const character of value) hash = (hash * 33) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(36);
};

export type SectionKind = "how-to" | "eligibility" | "problem" | "general";

const classifyQuestion = (question: string): SectionKind => {
  if (/\b(not working|isn'?t working|issue|issues|problem|error|can'?t|cannot|trouble|failed|fails|stuck|blocked|broken|doesn'?t work|stopped)\b/i.test(question)) return "problem";
  if (/^how\b/i.test(question) || /\bhow (do|can|should) (i|we|you)\b/i.test(question)) return "how-to";
  if (/^(can|am|do|is|are|when|what|where)\b/i.test(question) && /\b(can i|am i|do i|is there|are there|eligible|qualify|require|required|minimum|need|allow|allow(ed|s)?)\b/i.test(question)) return "eligibility";
  return "general";
};

// Strips leading interrogatives so the topic reads naturally inside templates:
// "How do I register as an affiliate?" -> "register as an affiliate".
const topicOf = (question: string): string => {
  const topic = question
    .replace(/^\s*(?:how (?:do|can|should) (?:i|we|you)|how to|what (?:is|are)|what(?:'s)?|can i|am i (?:able|eligible) to|am i|do i (?:need|have) to|do i|when (?:can|do|will) i|where can i|why (?:is|do|does|can))\s+/i, "")
    .replace(/\?+\s*$/, "")
    .trim();
  const picked = topic.split(/\s+/).slice(0, 8).join(" ");
  return picked || question.replace(/\?+\s*$/, "").trim();
};

const titleOf = (question: string): string => {
  const title = question.replace(/\?+\s*$/, "").trim();
  const capped = title.length > 60 ? `${title.slice(0, 57).replace(/\s+\S*$/, "")}...` : title;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
};

const personaFor = (kind: SectionKind, topic: string): string => {
  switch (kind) {
    case "how-to": return `A customer trying to ${topic} for the first time.`;
    case "eligibility": return `A customer asking whether they can ${topic}.`;
    case "problem": return `A frustrated customer with a problem involving ${topic}.`;
    default: return `A customer asking about ${topic}.`;
  }
};

const openingFor = (kind: SectionKind, topic: string): string => {
  switch (kind) {
    case "how-to": return `Hi, I need help with ${topic}. Can you walk me through it?`;
    case "eligibility": return `Hello, I would like to know if I can ${topic}. Can you check for me?`;
    case "problem": return `Hi, I am having trouble with ${topic}. Can you help me sort it out?`;
    default: return `Hi, I have a question about ${topic}. Can you help?`;
  }
};

const goalsFor = (kind: SectionKind): string[] => {
  const goals = ["Answer using only the confirmed facts", "Explain the documented next step"];
  if (kind === "problem") goals.unshift("Acknowledge the customer's problem");
  if (kind === "eligibility") goals.unshift("State the exact conditions from the source");
  return goals;
};

// Thin sections (short answers, placeholder headings, site furniture) do not
// become drills: a suggestion must have real material to practice against.
export const isSubstantiveSection = (fact: ReferenceFact): boolean => {
  if (/^reference detail \d+$/i.test(fact.question)) return false;
  if (NON_TOPIC_HEADINGS.test(fact.question.trim())) return false;
  if (wordsOf(fact.question).length < 2) return false;
  return wordsOf(fact.answer).length >= 6;
};

// A fact joins the drill when its heading shares at least two significant
// words with the primary section (e.g. "affiliate commission" sections group).
const relatedFactIds = (primary: ReferenceFact, facts: ReferenceFact[]): string[] => {
  const primaryWords = new Set(contentWords(primary.question));
  const related = facts
    .filter((fact) => fact.id !== primary.id && !fact.id.startsWith("note-"))
    .filter((fact) => contentWords(fact.question).filter((word) => primaryWords.has(word)).length >= 2)
    .map((fact) => fact.id);
  return [primary.id, ...related.slice(0, 3)];
};

export const deriveScenarios = (facts: ReferenceFact[]): ScenarioDefinition[] => {
  const sections = facts.filter((fact) => !fact.id.startsWith("note-"));
  const derived: ScenarioDefinition[] = [];
  const seen = new Set<string>();
  for (const fact of sections) {
    if (derived.length >= MAX_DERIVED_SCENARIOS) break;
    if (!isSubstantiveSection(fact)) continue;
    const id = `derived-${hashOf(`${fact.question.toLowerCase().trim()}\u0000${fact.answer.toLowerCase().trim().slice(0, 120)}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const kind = classifyQuestion(fact.question);
    const topic = topicOf(fact.question);
    derived.push({
      id,
      title: titleOf(fact.question),
      customerPersona: personaFor(kind, topic),
      openingLine: openingFor(kind, topic),
      goals: goalsFor(kind),
      factIds: relatedFactIds(fact, sections),
      difficulty: kind === "problem" ? "intermediate" : "beginner",
    });
  }
  return derived;
};

export const findDerivedScenario = (facts: ReferenceFact[], scenarioId: string): ScenarioDefinition | undefined =>
  deriveScenarios(facts).find((scenario) => scenario.id === scenarioId);
