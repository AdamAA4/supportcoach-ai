import { describe, expect, it } from "vitest";
import { DeterministicEvaluator } from "./deterministic-evaluator";
import { context, turn } from "./test-fixtures";

const evaluate = (transcript: ReturnType<typeof turn>[], notes = context.notes) =>
  new DeterministicEvaluator(context.sourceProvenance).evaluate({ ...context, notes, transcript });

describe("deterministic evaluation", () => {
  it("scores a supported trainee answer and retains the exact full transcript and provenance", async () => {
    const transcript = [turn("Can I get a refund?", "customer"), turn("I understand your concern. I am sorry. Refunds are available within 30 days for unopened items. Next, I will check your order and contact support.")];
    const report = await evaluate(transcript);
    expect(report.scores).toEqual({ factualAccuracy: 3, empathy: 3, clarity: 3, resolution: 3 });
    expect(report.missedFacts).toEqual([]);
    expect(report.unsupportedClaims).toEqual([]);
    expect(report.strengths).toHaveLength(2);
    expect(report.nextExercise).toEqual(expect.any(String));
    expect(report.transcript).toEqual(transcript);
    expect(report.sourceProvenance).toEqual(context.sourceProvenance);
  });
  it("does not count customer/system answers, questions, or keywords without conditions as a factual pass", async () => {
    for (const answer of ["Refunds are available.", "Are refunds available within 30 days for unopened items?", "refund 30 unopened", "I do not know."]) {
      const report = await evaluate([turn(context.facts[0].answer, "customer"), turn(context.facts[0].answer, "system"), turn(answer)]);
      expect(report.scores.factualAccuracy).toBe(0);
      expect(report.missedFacts).toEqual([context.facts[0].answer]);
    }
  });
  it.each(["Refunds are available within 60 days for unopened items.", "Refunds are not available within 30 days for unopened items.", "Refunds are available within 30 days for opened items."])("flags conflicting trainee claim: %s", async (answer) => {
    const report = await evaluate([turn(answer)]);
    expect(report.scores.factualAccuracy).toBe(0);
    expect(report.unsupportedClaims).toContain(answer);
    expect(report.missedFacts).toEqual([context.facts[0].answer]);
  });
  it("uses a personal note for one exercise but never for factual credit", async () => {
    const note = { id: "personal", text: "Refunds are always available. Pause before answering.", kind: "personal-coaching-note" as const, format: "plain-text" as const };
    const report = await evaluate([turn(note.text)], [note]);
    expect(report.scores.factualAccuracy).toBe(0);
    expect(report.nextExercise).toContain(note.text);
  });
  it("flags an unconditional refund promise that contradicts the confirmed eligibility conditions", async () => {
    const answer = "Refunds are always available for all items.";
    expect((await evaluate([turn(answer)])).unsupportedClaims).toContain(answer);
  });
  it("does not treat an unrelated negative sentence as a policy contradiction", async () => {
    const report = await evaluate([turn(`${context.facts[0].answer} You are not alone.`)]);
    expect(report.unsupportedClaims).toEqual([]);
    expect(report.scores.factualAccuracy).toBe(3);
  });
  it("keeps different confirmed numeric answers from contradicting one another", async () => {
    const second = { ...context.facts[0], id: "processing", answer: "Refund processing takes 5 business days.", keywords: ["refund", "processing", "days"] };
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({ ...context, facts: [...context.facts, second], scenario: { ...context.scenario, factIds: [...context.scenario.factIds, second.id] }, transcript: [turn(context.facts[0].answer), turn(second.answer)] });
    expect(report.scores.factualAccuracy).toBe(3);
    expect(report.unsupportedClaims).toEqual([]);
  });
  it("does not let a supported fact hide a contradiction in another factual clause", async () => {
    const second = { ...context.facts[0], id: "processing", answer: "Refund processing takes 5 business days.", keywords: ["refund", "processing", "days"] };
    const answer = "Refunds are available within 30 days for unopened items, but refund processing takes 7 business days.";
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context,
      facts: [...context.facts, second],
      scenario: { ...context.scenario, factIds: [...context.scenario.factIds, second.id] },
      transcript: [turn(answer)],
    });
    expect(report.missedFacts).toEqual([second.answer]);
    expect(report.unsupportedClaims).toContain(answer);
  });
  it("supports an equivalent confirmed negative fact phrased with aren't", async () => {
    const fact = { ...context.facts[0], answer: "Refunds are not available after 30 days.", keywords: ["refunds", "available", "days"] };
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context,
      facts: [fact],
      transcript: [turn("Refunds aren't available after 30 days.")],
    });
    expect(report.scores.factualAccuracy).toBe(3);
    expect(report.missedFacts).toEqual([]);
    expect(report.unsupportedClaims).toEqual([]);
  });
  it.each([
    "Exchanges are available for damaged items and returns are accepted for opened items",
    "Returns are accepted for opened items and exchanges are available for damaged items",
  ])("checks every fact independently in a coordinated claim: %s", async (answer) => {
    const exchange = { ...context.facts[0], id: "exchange", answer: "Exchanges are available for damaged items", keywords: ["exchanges", "damaged"] };
    const returns = { ...context.facts[0], id: "returns", answer: "Returns are accepted for unopened items", keywords: ["returns", "unopened"] };
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context, facts: [exchange, returns], scenario: { ...context.scenario, factIds: [exchange.id, returns.id] }, transcript: [turn(answer)],
    });
    expect(report.missedFacts).toEqual([returns.answer]);
    expect(report.unsupportedClaims).toEqual([answer]);
  });
  it("keeps different correct numeric claims independent within one coordinated sentence", async () => {
    const second = { ...context.facts[0], id: "processing", answer: "Refund processing takes 5 business days", keywords: ["refund", "processing", "days"] };
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context, facts: [...context.facts, second], scenario: { ...context.scenario, factIds: [...context.scenario.factIds, second.id] },
      transcript: [turn(`Refunds are available within 30 days for unopened items and ${second.answer.toLowerCase()}.`)],
    });
    expect(report.scores.factualAccuracy).toBe(3);
    expect(report.missedFacts).toEqual([]);
    expect(report.unsupportedClaims).toEqual([]);
  });
  it("preserves a conjunction required by a confirmed fact", async () => {
    const first = { ...context.facts[0], answer: "Refunds and exchanges are available for unopened items", keywords: ["refunds", "exchanges", "unopened"] };
    const second = { ...context.facts[0], id: "exchange", answer: "Exchanges take 5 business days", keywords: ["exchanges", "days"] };
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context, facts: [first, second], scenario: { ...context.scenario, factIds: [first.id, second.id] }, transcript: [turn(first.answer)],
    });
    expect(report.missedFacts).toEqual([second.answer]);
    expect(report.unsupportedClaims).toEqual([]);
  });
  it("acknowledges demonstrated facts when correct coverage earns a factual score of two", async () => {
    const second = { ...context.facts[0], id: "processing", answer: "Refund processing takes 5 business days.", keywords: ["refund", "processing", "days"] };
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context, facts: [...context.facts, second], scenario: { ...context.scenario, factIds: [...context.scenario.factIds, second.id] }, transcript: [turn(context.facts[0].answer)],
    });
    expect(report.scores.factualAccuracy).toBe(2);
    expect(report.strengths[0]).toBe("You stated some confirmed reference facts accurately.");
    expect(report.missedFacts).toEqual([second.answer]);
  });
  it("does not let a rounded score claim complete factual coverage", async () => {
    const facts = ["Refunds", "Exchanges", "Returns", "Shipping", "Delivery", "Collection"].map((topic) => ({
      ...context.facts[0], id: topic, answer: `${topic} are available`, keywords: [topic],
    }));
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context, facts, scenario: { ...context.scenario, factIds: facts.map((fact) => fact.id) }, transcript: facts.slice(0, 5).map((fact) => turn(fact.answer)),
    });
    expect(report.scores.factualAccuracy).toBe(3);
    expect(report.strengths[0]).toBe("You stated some confirmed reference facts accurately.");
    expect(report.missedFacts).toEqual([facts[5].answer]);
  });
  it("does not apply unrelated don't-worry reassurance to a supported factual clause", async () => {
    const answer = "Refunds are available within 30 days for unopened items, and don't worry.";
    const report = await evaluate([turn(answer)]);
    expect(report.scores.factualAccuracy).toBe(3);
    expect(report.missedFacts).toEqual([]);
    expect(report.unsupportedClaims).toEqual([]);
  });
  it("detects isn't as a direct contradiction of an affirmative fact", async () => {
    const fact = { ...context.facts[0], answer: "A refund is available within 30 days for unopened items.", keywords: ["refund", "available", "days", "unopened"] };
    const answer = "A refund isn't available within 30 days for unopened items.";
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context,
      facts: [fact],
      transcript: [turn(answer)],
    });
    expect(report.unsupportedClaims).toContain(answer);
    expect(report.missedFacts).toEqual([fact.answer]);
  });
  it("does not score approved advice entries as confirmed FAQ facts", async () => {
    const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({
      ...context, facts: [{ ...context.facts[0], id: "note-advice" }],
      scenario: { ...context.scenario, factIds: ["note-advice"] }, transcript: [turn(context.facts[0].answer)],
    });
    expect(report.scores.factualAccuracy).toBe(0);
  });
  it("returns bounded zero scores and an actionable exercise for an empty call", async () => {
    const report = await evaluate([]);
    expect(report.scores).toEqual({ factualAccuracy: 0, empathy: 0, clarity: 0, resolution: 0 });
    expect(report.nextExercise.length).toBeGreaterThan(0);
    expect(report.strengths).toEqual([
      "No factual strength was demonstrated in this attempt.",
      "No communication strength was demonstrated in this attempt.",
    ]);
  });
  it("keeps weak-call strengths observational rather than instructional", async () => {
    const report = await evaluate([turn("I do not know.")]);
    expect(report.strengths).toHaveLength(2);
    expect(report.strengths.join(" ")).not.toMatch(/\b(?:use|build|try|should)\b/i);
  });
});
