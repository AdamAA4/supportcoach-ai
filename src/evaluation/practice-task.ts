import type { ScenarioDefinition, Score } from "../domain/practice-pack";
import type { ReferenceFact } from "../domain/reference-source";

export type PracticeTask = {
  openingLine: string;
  focus: string;
  facts: Array<{ question: string; answer: string }>;
  checklist: string[];
  needsConfirmation: boolean;
};

export type PracticeTaskInput = {
  scenario: ScenarioDefinition;
  referenceFacts: ReferenceFact[];
  missedFacts: string[];
  unsupportedClaims: string[];
  scores: { factualAccuracy: Score; empathy: Score; clarity: Score; resolution: Score };
};

const factCards = (facts: ReferenceFact[]): Array<{ question: string; answer: string }> =>
  facts.slice(0, 2).map(({ question, answer }) => ({ question, answer }));

// Builds the report's concrete practice drill: the customer's opening line,
// what to rehearse, the confirmed facts to include, and a short checklist.
// When no confirmed fact grounds the scenario, the task says what needs
// confirmation instead of inventing content.
export const buildPracticeTask = (input: PracticeTaskInput): PracticeTask => {
  const { scenario, referenceFacts, missedFacts, unsupportedClaims, scores } = input;
  const openingLine = scenario.openingLine;

  if (referenceFacts.length === 0) {
    return {
      openingLine,
      focus: "No confirmed FAQ fact covers this scenario yet, so there is nothing to score against. Confirm the FAQ or policy text that should ground this scenario, then run the exercise again.",
      facts: [],
      checklist: [
        "Confirm the FAQ or policy text for this scenario",
        "Re-run the exercise after the source is updated",
      ],
      needsConfirmation: true,
    };
  }

  if (missedFacts.length > 0) {
    const missed = referenceFacts.filter((fact) => missedFacts.includes(fact.answer));
    const focusFact = missed[0];
    return {
      openingLine,
      focus: `Practice stating the confirmed answer to "${focusFact?.question ?? missedFacts[0]}". Keep the fact's key terms and do not add conditions the FAQ does not include.`,
      facts: factCards(missed),
      checklist: [
        "Give the confirmed answer in your own words, keeping its key terms",
        "Do not add conditions the FAQ does not state",
        "Close with the documented next step",
      ],
      needsConfirmation: false,
    };
  }

  if (unsupportedClaims.length > 0) {
    return {
      openingLine,
      focus: "Practice giving only what the confirmed fact supports, and say you will check anything beyond it.",
      facts: factCards(referenceFacts.slice(0, 2)),
      checklist: [
        "State only what the confirmed fact says",
        "Say you will confirm anything beyond the FAQ",
        "Do not promise outcomes the FAQ does not support",
      ],
      needsConfirmation: false,
    };
  }

  const lowest = (Object.entries(scores) as Array<[keyof typeof scores, Score]>).sort((a, b) => a[1] - b[1])[0][0];
  if (lowest === "empathy") {
    return {
      openingLine,
      focus: "Acknowledge how the customer feels before giving the confirmed policy answer.",
      facts: factCards(referenceFacts.slice(0, 2)),
      checklist: [
        "Open by acknowledging the customer's situation",
        "Apologize when it is warranted",
        "Then give the confirmed answer",
      ],
      needsConfirmation: false,
    };
  }
  if (lowest === "clarity") {
    return {
      openingLine,
      focus: "Practice answering in short, direct sentences.",
      facts: factCards(referenceFacts.slice(0, 2)),
      checklist: [
        "Lead with the direct answer",
        "Keep each sentence short",
        "Add conditions only when the FAQ states them",
      ],
      needsConfirmation: false,
    };
  }
  if (lowest === "resolution") {
    return {
      openingLine,
      focus: "Practice ending every answer with a concrete next step.",
      facts: factCards(referenceFacts.slice(0, 2)),
      checklist: [
        "Give the confirmed answer",
        "Offer the documented next step",
        "Say when you would escalate",
      ],
      needsConfirmation: false,
    };
  }
  return {
    openingLine,
    focus: "Practice restating the confirmed facts accurately while the customer pushes for more.",
    facts: factCards(referenceFacts.slice(0, 2)),
    checklist: [
      "State each confirmed fact with its conditions",
      "Avoid contradicting the FAQ",
      "Keep the answer direct",
    ],
    needsConfirmation: false,
  };
};
