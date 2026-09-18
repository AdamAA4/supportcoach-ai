import { describe, expect, it } from "vitest";
import { buildQuestionPlan } from "./question-plan";
import { createScenarioDefinition } from "../data/seed-packs";
import type { ReferenceFact } from "../domain/reference-source";

const fact = (id: string, question: string, answer: string, keywords: string[]): ReferenceFact => ({
  id, question, answer, keywords, source: "faq",
});

const facts: ReferenceFact[] = [
  fact("f1", "When is a refund available?", "Refunds are available within 30 days for unopened items.", ["refund", "30", "unopened"]),
  fact("f2", "When is a refund available?", "Duplicate copy of the same answer.", ["refund"]),
  fact("f3", "What is slippage?", "Unrelated content.", ["slippage"]),
  fact("f4", "Reference detail 2", "A policy paragraph without its own question.", ["policy"]),
  fact("note-1", "Coach note question?", "Personal coaching content.", ["refund"]),
];

const scenario = createScenarioDefinition("refund-eligibility", facts);

describe("buildQuestionPlan", () => {
  it("grounds every planned question in a scenario-relevant confirmed fact", () => {
    const plan = buildQuestionPlan(scenario, facts);
    expect(plan.length).toBeGreaterThan(0);
    for (const item of plan) {
      expect(scenario.factIds).toContain(item.factId);
      expect(item.factId.startsWith("note-")).toBe(false);
    }
    expect(plan.map((item) => item.factId)).not.toContain("f3");
    expect(plan.map((item) => item.factId)).not.toContain("note-1");
  });

  it("never repeats a question", () => {
    const plan = buildQuestionPlan(scenario, facts);
    const questions = plan.map((item) => item.question.toLowerCase());
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("drops duplicated questions and keeps the first grounded occurrence", () => {
    const plan = buildQuestionPlan(scenario, facts);
    expect(plan.filter((item) => item.factId === "f1")).toHaveLength(1);
    expect(plan.filter((item) => item.factId === "f2")).toHaveLength(0);
  });

  it("uses the source question verbatim when it is already a question", () => {
    const plan = buildQuestionPlan(scenario, facts);
    expect(plan.find((item) => item.factId === "f1")?.question).toBe("When is a refund available?");
  });

  it("degrades placeholder questions to a grounded clarification instead of inventing content", () => {
    const plan = buildQuestionPlan(scenario, facts);
    const placeholder = plan.find((item) => item.factId === "f4");
    expect(placeholder?.question).toMatch(/based on the policy/i);
  });
});
