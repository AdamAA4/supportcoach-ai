import { afterEach, describe, expect, it, vi } from "vitest";
import { GroundedEvaluator } from "./grounded-evaluator";
import { context, turn } from "./test-fixtures";
import * as llm from "../app/api/reference-import/llm";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const fact = { ...context.facts[0], id: "profit", question: "How much profit is required to meet payout requirements?", answer: "You have to generate 10% profits to meet payout requirements." };
const input = (text = "You need to gain ten percent profit.") => ({ ...context, facts: [fact], scenario: { ...context.scenario, factIds: [fact.id] }, transcript: [turn(text)] });
const response = (data: ReturnType<typeof input>, status = "supported", quote = data.transcript[0].text, turnId = data.transcript[0].id) => JSON.stringify({ results: [{ factId: fact.id, status, evidence: status === "missed" ? [] : [{ turnId, quote }] }] });
const configure = () => { vi.stubEnv("LLM_PROVIDER", "gemini"); vi.stubEnv("LLM_API_KEY", "test-key"); };

describe("grounded semantic evaluation", () => {
  it("credits the product lead's profit paraphrase by meaning and keeps the exact transcript", async () => {
    configure(); const data = input();
    const generate = vi.spyOn(llm, "generateLlmText").mockResolvedValue(response(data));
    const report = await new GroundedEvaluator(context.sourceProvenance).evaluate(data);
    expect(report).toMatchObject({ evaluationMethod: "semantic", scores: { factualAccuracy: 3 }, missedFacts: [], transcript: data.transcript });
    expect(generate.mock.calls[0][0]).toContain("Judge meaning, not copied wording");
    expect(generate.mock.calls[0][0]).toContain("Judge each fact independently");
    expect(generate.mock.calls[0][0]).toContain("It does not support weekend holding");
    expect(generate.mock.calls[0][1]).toEqual({ timeoutMs: 9000, json: true, retryTransient: true });
  });
  it.each(["You need to gain 5% profit.", "You need to gain 10 dollars profit."])("vetoes a model credit with an incorrect value or percentage unit: %s", async (text) => {
    configure(); const data = input(text);
    vi.spyOn(llm, "generateLlmText").mockResolvedValue(response(data));
    expect((await new GroundedEvaluator(context.sourceProvenance).evaluate(data)).missedFacts).toEqual([fact.answer]);
  });
  it.each(["invented", "customer", "question"])("does not credit %s evidence", async (kind) => {
    configure(); const data = input(kind === "question" ? "Do I need to gain ten percent profit?" : kind === "invented" ? "I will check." : undefined);
    if (kind === "customer") data.transcript[0].speaker = "customer";
    if (kind === "customer") data.transcript.push(turn("I will check."));
    vi.spyOn(llm, "generateLlmText").mockResolvedValue(response(data, "supported", kind === "invented" ? "I earned 10% profit." : data.transcript[0].text));
    expect((await new GroundedEvaluator(context.sourceProvenance).evaluate(data)).missedFacts).toEqual([fact.answer]);
  });
  it("does not infer an omitted numeric condition", async () => {
    configure(); const data = input();
    data.facts[0] = { ...fact, answer: "Generate 10% profits after at least 5 trading days." };
    vi.spyOn(llm, "generateLlmText").mockResolvedValue(response(data));
    expect((await new GroundedEvaluator(context.sourceProvenance).evaluate(data)).missedFacts).toEqual([data.facts[0].answer]);
  });
  it("retains a grounded contradiction and does not create a fake transcript", async () => {
    configure(); const data = input("You need only 5% profit.");
    vi.spyOn(llm, "generateLlmText").mockResolvedValue(response(data, "conflict"));
    const report = await new GroundedEvaluator(context.sourceProvenance).evaluate(data);
    expect(report.unsupportedClaims).toContain(data.transcript[0].text);
    expect(report.transcript).toEqual(data.transcript);
    expect(report.scores.factualAccuracy).toBe(0);
  });
  it.each(["bad JSON", '{"results":[{"factId":"unknown","status":"supported","evidence":[]}]}'])("uses a labeled safe fallback for invalid output: %s", async (text) => {
    configure(); const data = input();
    vi.spyOn(llm, "generateLlmText").mockResolvedValue(text);
    expect((await new GroundedEvaluator(context.sourceProvenance).evaluate(data)).evaluationMethod).toBe("deterministic");
  });
  it("uses a labeled fallback after provider failure", async () => {
    configure(); vi.spyOn(llm, "generateLlmText").mockRejectedValue(new Error("llm-http-503"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await new GroundedEvaluator(context.sourceProvenance).evaluate(input())).evaluationMethod).toBe("deterministic");
    expect(warn).toHaveBeenCalledWith("supportcoach.coaching_fallback", { reason: "llm-http-503" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("test-key");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("You need");
  });
  it("does not call the model without configuration", async () => {
    vi.stubEnv("LLM_API_KEY", ""); const generate = vi.spyOn(llm, "generateLlmText");
    expect((await new GroundedEvaluator(context.sourceProvenance).evaluate(input())).evaluationMethod).toBe("deterministic");
    expect(generate).not.toHaveBeenCalled();
  });
});
