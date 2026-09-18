import type { ScenarioDefinition } from "../domain/practice-pack";
import type { ReferenceFact } from "../domain/reference-source";

export type PlannedQuestion = { factId: string; question: string };

const MAX_PLAN_QUESTIONS = 8;

const normalizeQuestion = (question: string): string =>
  question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The customer asks from the confirmed source only: each planned question is
// grounded in one scenario fact, placeholder-style questions degrade to a
// grounded clarification, and nothing is invented beyond the fact text.
const naturalQuestion = (fact: ReferenceFact): string => {
  const question = fact.question.trim();
  if (question.endsWith("?") && question.length <= 200) return question;
  if (/^reference detail \d+$/i.test(question)) {
    return "Can you tell me more about how that works, based on the policy you have?";
  }
  return `Can you tell me more about "${question}"?`;
};

export const buildQuestionPlan = (scenario: ScenarioDefinition, facts: ReferenceFact[]): PlannedQuestion[] => {
  const seen = new Set<string>();
  const plan: PlannedQuestion[] = [];
  for (const fact of facts) {
    if (plan.length >= MAX_PLAN_QUESTIONS) break;
    if (fact.id.startsWith("note-") || !scenario.factIds.includes(fact.id)) continue;
    if (!fact.question.trim() || !fact.answer.trim()) continue;
    const question = naturalQuestion(fact);
    const key = normalizeQuestion(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    plan.push({ factId: fact.id, question });
  }
  return plan;
};
