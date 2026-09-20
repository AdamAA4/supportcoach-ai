import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPairsWithLlm, isLlmConfigured } from "./llm";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isLlmConfigured", () => {
  it("is false when no provider or key is set", () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    expect(isLlmConfigured()).toBe(false);
  });

  it("is true when both provider and key are set", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.LLM_API_KEY = "test-key";
    expect(isLlmConfigured()).toBe(true);
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
  });
});

describe("extractPairsWithLlm", () => {
  it("parses a Gemini payload into question/answer pairs", async () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.LLM_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: '[{"question":"How does the KYC verification work?","answer":"Submit your documents and verification completes within 24 hours."}]' }] } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const pairs = await extractPairsWithLlm("How does the KYC verification work? Submit your documents.");

    expect(pairs).toEqual([{ question: "How does the KYC verification work?", answer: "Submit your documents and verification completes within 24 hours." }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect((init as { headers: Record<string, string> }).headers["x-goog-api-key"]).toBe("test-key");
    expect(JSON.stringify((init as { body: string }).body)).not.toContain("test-key");
  });

  it("calls OpenAI with a bearer key when the provider is openai", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { content: '[{"question":"When?","answer":"Soon."}]' } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const pairs = await extractPairsWithLlm("content");
    expect(pairs).toEqual([{ question: "When?", answer: "Soon." }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("api.openai.com");
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe("Bearer test-key");
  });

  it("returns no pairs when the model reports NO_ANSWERS", async () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.LLM_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "NO_ANSWERS" }] } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    expect(await extractPairsWithLlm("content")).toEqual([]);
  });

  it("parses JSON wrapped in markdown fences", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { content: "```json\n[{\"question\":\"When?\",\"answer\":\"Soon.\"}]\n```" } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    expect(await extractPairsWithLlm("content")).toEqual([{ question: "When?", answer: "Soon." }]);
  });

  it("throws a typed error on unparseable model output", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json at all", { status: 200 })));
    await expect(extractPairsWithLlm("content")).rejects.toThrow("llm-unparseable");
  });
});
