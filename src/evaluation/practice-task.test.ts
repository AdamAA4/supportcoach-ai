import { describe, expect, it } from "vitest";
import { buildPracticeTask } from "./practice-task";
import { createScenarioDefinition } from "../data/seed-packs";
import type { ReferenceFact } from "../domain/reference-source";
import type { Score } from "../domain/practice-pack";

const fact = (id: string, question: string, answer: string): ReferenceFact => ({
  id, question, answer, keywords: ["refund"], source: "policy",
});

const facts = [
  fact("source-fact-1", "When is a refund available?", "Refunds are available within 30 days for unopened items."),
  fact("source-fact-2", "How do I track my parcel?", "Use the tracking link from your dispatch email."),
];

const scenario = createScenarioDefinition("refund-eligibility", facts);
type Scores = { factualAccuracy: Score; empathy: Score; clarity: Score; resolution: Score };
const scores = (overrides: Partial<Scores> = {}): Scores => ({
  factualAccuracy: 3, empathy: 3, clarity: 3, resolution: 3, ...overrides,
});

describe("buildPracticeTask", () => {
  it("builds a missed-fact drill from the missed confirmed answer", () => {
    const task = buildPracticeTask({
      scenario, referenceFacts: facts, missedFacts: [facts[0].answer], unsupportedClaims: [],
      scores: scores({ factualAccuracy: 0 }),
    });
    expect(task.needsConfirmation).toBe(false);
    expect(task.focus).toContain("When is a refund available?");
    expect(task.facts[0]).toEqual({ question: facts[0].question, answer: facts[0].answer });
    expect(task.checklist.length).toBeGreaterThanOrEqual(3);
  });

  it("builds an unsupported-claim drill about staying inside the FAQ", () => {
    const task = buildPracticeTask({
      scenario, referenceFacts: facts, missedFacts: [], unsupportedClaims: ["We guarantee funding."],
      scores: scores(),
    });
    expect(task.focus).toMatch(/check|supports/i);
    expect(task.facts.length).toBeGreaterThan(0);
  });

  it("builds an empathy drill when empathy is the lowest score", () => {
    const task = buildPracticeTask({
      scenario, referenceFacts: facts, missedFacts: [], unsupportedClaims: [],
      scores: scores({ empathy: 0 }),
    });
    expect(task.focus).toMatch(/acknowledge/i);
    expect(task.checklist.some((item) => /apolog/i.test(item))).toBe(true);
  });

  it("builds a clarity drill when clarity is the lowest score", () => {
    const task = buildPracticeTask({
      scenario, referenceFacts: facts, missedFacts: [], unsupportedClaims: [],
      scores: scores({ clarity: 0 }),
    });
    expect(task.focus).toMatch(/short|direct/i);
  });

  it("builds a resolution drill when resolution is the lowest score", () => {
    const task = buildPracticeTask({
      scenario, referenceFacts: facts, missedFacts: [], unsupportedClaims: [],
      scores: scores({ resolution: 0 }),
    });
    expect(task.focus).toMatch(/next step/i);
  });

  it("asks for confirmation when no confirmed fact grounds the scenario", () => {
    const task = buildPracticeTask({
      scenario, referenceFacts: [], missedFacts: [], unsupportedClaims: [], scores: scores(),
    });
    expect(task.needsConfirmation).toBe(true);
    expect(task.focus).toMatch(/confirm/i);
    expect(task.facts).toHaveLength(0);
  });

  it("always carries the scenario's customer opening line", () => {
    const task = buildPracticeTask({
      scenario, referenceFacts: facts, missedFacts: [], unsupportedClaims: [], scores: scores(),
    });
    expect(task.openingLine).toBe(scenario.openingLine);
  });
});
