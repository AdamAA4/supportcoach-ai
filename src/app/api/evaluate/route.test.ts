// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { DeterministicEvaluator } from "../../../evaluation/deterministic-evaluator";
import { context, requestBody, turn } from "../../../evaluation/test-fixtures";
import { normalizePracticeContext } from "../../../domain/validation";

const send = (body: unknown) => POST(new Request("http://localhost/api/evaluate", { method: "POST", body: JSON.stringify(body) }));
afterEach(() => vi.restoreAllMocks());
describe("evaluation route", () => {
  it("returns an evaluated report with the exact source and transcript", async () => {
    const body = requestBody();
    const response = await send(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ transcript: body.transcript, sourceProvenance: context.sourceProvenance });
  });
  it.each([null, {}, { context: {} }, { ...requestBody(), transcript: [{ text: "hi" }] }, { ...requestBody(), transcript: "bad" }])("rejects malformed input %j", async (body) => {
    const response = await send(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_evaluation" } });
  });
  it("rejects malformed JSON", async () => {
    expect((await POST(new Request("http://localhost/api/evaluate", { method: "POST", body: "{" }))).status).toBe(400);
  });
  it("rejects non-string speaker and source values rather than coercing them", async () => {
    for (const field of ["speaker", "source"]) {
      const entry = turn("A response");
      expect((await send(requestBody([{ ...entry, [field]: [entry[field as "speaker" | "source"]] } as never]))).status).toBe(400);
    }
  });
  it("accepts the inclusive limits but rejects over 200 turns or 20,000 text characters", async () => {
    const atLimit = await send(requestBody(Array.from({ length: 200 }, () => turn("a".repeat(100)))));
    const tooMany = await send(requestBody(Array.from({ length: 201 }, () => turn("a"))));
    const tooLong = await send(requestBody([turn("a".repeat(20001))]));
    expect(atLimit.status).toBe(200);
    expect(tooMany.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });
  it("rejects stale hashes, altered normalized facts, and unconfirmed sources", async () => {
    expect((await send({ ...requestBody(), sourceContentHash: "stale" })).status).toBe(400);
    const facts = [{ ...context.facts[0], answer: "Refunds always apply." }];
    expect((await send({ ...requestBody(), facts, context: { ...context, facts } })).status).toBe(400);
    expect((await send({ ...requestBody(), context: { ...context, source: { ...context.source, confirmation: "pending" } } })).status).toBe(400);
  });
  it("checks imported snapshot SHA-256 as well as the supplied hash", async () => {
    const hash = `sha256:${createHash("sha256").update(context.sourceText).digest("hex")}`;
    const imported = normalizePracticeContext({ source: { kind: "public-https-link", confirmation: "confirmed", url: "https://example.com/faq", snapshot: { extractedText: context.sourceText, contentHash: hash } }, sourceLabel: context.sourceLabel, notes: [], scenarioId: "refund-eligibility" });
    expect((await send({ ...requestBody(), context: imported, sourceContentHash: hash })).status).toBe(200);
    expect((await send({ ...requestBody(), context: { ...imported, source: { ...imported.source, snapshot: { extractedText: "Changed", contentHash: hash } } }, sourceContentHash: hash })).status).toBe(400);
  });
  it("returns a stable error without leaking evaluator details", async () => {
    vi.spyOn(DeterministicEvaluator.prototype, "evaluate").mockRejectedValue(new Error("private transcript"));
    const response = await send(requestBody());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "evaluation_failed", message: "The coaching report could not be generated. Please try again." } });
  });
});
