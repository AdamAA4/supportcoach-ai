import type { ScenarioDefinition } from "../domain/practice-pack";
import type { ReferenceFact } from "../domain/reference-source";
import { findDerivedScenario } from "../domain/derived-scenarios";

const archetypes = {
  "late-delivery": {
    title: "Late delivery",
    customerPersona: "A concerned customer waiting for a delayed order.",
    openingLine: "My order was meant to arrive already. Where is it?",
    goals: ["Acknowledge the delay", "Set a clear next step", "Use only confirmed delivery facts"],
    difficulty: "beginner" as const,
    terms: ["delivery", "arrive", "dispatch", "order", "late"],
  },
  "refund-eligibility": {
    title: "Refund eligibility",
    customerPersona: "A customer asking whether their purchase qualifies for a refund.",
    openingLine: "Can I get a refund for this order?",
    goals: ["Clarify eligibility", "Explain the applicable policy", "Offer the next step"],
    difficulty: "intermediate" as const,
    terms: ["refund", "return", "cancel", "unopened", "policy"],
  },
};

export const FALLBACK_REFERENCE_FACTS: ReferenceFact[] = [
  { id: "fallback-delivery-window", question: "When will my order arrive?", answer: "Standard delivery takes 3 to 5 business days.", keywords: ["delivery", "arrive", "order"], source: "faq" },
  { id: "fallback-delivery-delay", question: "What if delivery is late?", answer: "Check the tracking link and contact support after the delivery window has passed.", keywords: ["delivery", "late", "tracking"], source: "faq" },
  { id: "fallback-refund-window", question: "When is a refund available?", answer: "Refunds are available within 30 days for unopened items.", keywords: ["refund", "30", "unopened"], source: "policy" },
  { id: "fallback-cancellation", question: "Can I cancel an order?", answer: "Orders can be cancelled before dispatch.", keywords: ["cancel", "order", "dispatch"], source: "policy" },
];

export const createScenarioDefinition = (
  scenarioId: string,
  facts: ReferenceFact[],
): ScenarioDefinition => {
  // Content-derived ids resolve against the fact list; derivation is
  // deterministic, so a stored session rebuilds the same scenario.
  if (scenarioId.startsWith("derived-")) {
    const derived = findDerivedScenario(facts, scenarioId);
    if (derived) return derived;
  }
  // Legacy ids still resolve so previously stored sessions stay valid.
  const archetype = archetypes[scenarioId as keyof typeof archetypes];
  if (!archetype) {
    // Unresolved selection (empty or stale): an honest placeholder with no
    // facts, which setup validation rejects instead of silently swapping
    // in an unrelated drill.
    return {
      id: scenarioId,
      title: "Choose a practice drill",
      customerPersona: "",
      openingLine: "",
      goals: [],
      factIds: [],
      difficulty: "beginner",
    };
  }
  const relevantFacts = facts.filter((fact) =>
    archetype.terms.some((term) => fact.keywords.includes(term)),
  );

  return {
    id: scenarioId,
    title: archetype.title,
    customerPersona: archetype.customerPersona,
    openingLine: archetype.openingLine,
    goals: archetype.goals,
    factIds: (relevantFacts.length > 0 ? relevantFacts : facts.slice(0, 2)).map((fact) => fact.id),
    difficulty: archetype.difficulty,
  };
};
