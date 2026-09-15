import { describe, expect, it } from "vitest";

import type { CoachingReport } from "./report";
import { normalizePracticeContext, validatePracticeContext } from "./validation";

const confirmedSource = {
  kind: "pasted-text" as const,
  text: "Delivery FAQ\nQ: When will my order arrive?\nA: Standard delivery takes 3 to 5 business days.\nQ: Can I cancel?\nA: Orders can be cancelled before dispatch.",
  confirmation: "confirmed" as const,
};

describe("practice context validation", () => {
  it("accepts a confirmed company source whose scenario facts resolve", () => {
    const context = normalizePracticeContext({
      source: confirmedSource,
      sourceLabel: "Northstar Shop",
      notes: [],
      scenarioId: "late-delivery",
    });

    expect(validatePracticeContext({ companyName: "Northstar Shop", context })).toEqual({ ok: true });
  });

  it("returns field errors for each invalid setup boundary", () => {
    const context = normalizePracticeContext({
      source: { ...confirmedSource, text: " " },
      sourceLabel: "",
      notes: [{ id: "note-1", text: "", format: "plain-text", kind: "personal-coaching-note" }],
      scenarioId: "late-delivery",
    });

    const result = validatePracticeContext({
      companyName: "",
      context: {
        ...context,
        facts: [
          { id: "fact-1", question: "When?", answer: "", keywords: [], source: "faq" },
          { id: "fact-1", question: "Again?", answer: "Available soon.", keywords: [], source: "faq" },
        ],
        scenario: { ...context.scenario, factIds: ["missing-fact"] },
      },
      noteFileSizeBytes: 200 * 1024 + 1,
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        companyName: ["Enter your company name."],
        source: ["Extracted FAQ/policy text is required."],
        facts: ["Each extracted fact needs an answer.", "Fact IDs must be unique."],
        scenario: ["The selected scenario refers to a fact that is not available in this source."],
        notes: ["A notes file must be 200 KB or smaller."],
      },
    });
  });

  it("rejects malformed and non-HTTPS reference URLs", () => {
    const context = normalizePracticeContext({
      source: { kind: "public-https-link", url: "ftp://example.com/faq", confirmation: "pending" },
      sourceLabel: "Northstar Shop",
      notes: [],
      scenarioId: "late-delivery",
    });

    expect(validatePracticeContext({ companyName: "Northstar Shop", context })).toEqual({
      ok: false,
      errors: {
        source: ["Use an HTTPS FAQ or policy URL.", "Extracted FAQ/policy text is required.", "Confirm the extracted source preview before starting."],
      },
    });

    const malformed = normalizePracticeContext({
      source: { kind: "public-https-link", url: "https://", confirmation: "pending" },
      sourceLabel: "Northstar Shop",
      notes: [],
      scenarioId: "late-delivery",
    });

    expect(validatePracticeContext({ companyName: "Northstar Shop", context: malformed })).toEqual({
      ok: false,
      errors: {
        source: ["Enter a valid FAQ or policy URL.", "Extracted FAQ/policy text is required.", "Confirm the extracted source preview before starting."],
      },
    });
  });

  it("retains personal coaching notes while excluding them from fact matching", () => {
    const context = normalizePracticeContext({
      source: confirmedSource,
      sourceLabel: "Northstar Shop",
      notes: [
        { id: "approved", text: "Confirm the order number first.", format: "markdown", kind: "approved-practice-advice" },
        { id: "private", text: "Remember to breathe before answering.", format: "plain-text", kind: "personal-coaching-note" },
      ],
      scenarioId: "late-delivery",
    });

    expect(context.notes).toHaveLength(2);
    expect(context.facts.map((fact) => fact.answer)).not.toContain("Remember to breathe before answering.");
    expect(context.facts.map((fact) => fact.answer)).toContain("Confirm the order number first.");
    expect(context.notes).toEqual([
      { id: "approved", text: "Confirm the order number first.", format: "markdown", kind: "approved-practice-advice" },
      { id: "private", text: "Remember to breathe before answering.", format: "plain-text", kind: "personal-coaching-note" },
    ]);
  });

  it("uses the authoritative pack validator for unsupported runtime scenarios and blank confirmed hashes", () => {
    const invalidScenario = normalizePracticeContext({
      source: confirmedSource,
      sourceLabel: "Northstar Shop",
      notes: [],
      scenarioId: "late-delivery",
    });
    invalidScenario.scenario = { ...invalidScenario.scenario, id: "damaged-item" as "late-delivery" };

    const blankHash = normalizePracticeContext({
      source: {
        kind: "public-https-link",
        url: "https://example.com/faq",
        confirmation: "confirmed",
        snapshot: { extractedText: "Delivery FAQ", contentHash: "sha256:valid" },
      },
      sourceLabel: "Northstar Shop",
      notes: [],
      scenarioId: "late-delivery",
    });
    blankHash.source = {
      kind: "public-https-link",
      url: "https://example.com/faq",
      confirmation: "confirmed",
      snapshot: { extractedText: "Delivery FAQ", contentHash: " " },
    } as never;

    expect(validatePracticeContext({ companyName: "Northstar Shop", context: invalidScenario })).toMatchObject({
      ok: false,
      errors: { scenario: ["Choose a supported practice scenario."] },
    });
    expect(validatePracticeContext({ companyName: "Northstar Shop", context: blankHash })).toMatchObject({
      ok: false,
      errors: { source: ["Confirmed public links require a non-empty sanitized source snapshot and content hash."] },
    });
  });

  it("retains immutable source provenance in a coaching report", () => {
    const context = normalizePracticeContext({
      source: {
        kind: "public-https-link",
        url: "https://example.com/refunds",
        confirmation: "confirmed",
        snapshot: { extractedText: "Refund policy", contentHash: "sha256:report-source" },
      },
      sourceLabel: "Northstar Shop",
      notes: [],
      scenarioId: "refund-eligibility",
    });
    const report: CoachingReport = {
      callId: "call-1", scenarioId: context.scenario.id, completedAt: "2026-09-15T00:00:00Z",
      scores: { factualAccuracy: 3, empathy: 3, clarity: 3, resolution: 3 },
      strengths: [], missedFacts: [], unsupportedClaims: [], nextExercise: "Repeat the scenario.", transcript: [],
      sourceProvenance: context.sourceProvenance,
    };

    expect(report.sourceProvenance).toEqual({ sourceUrl: "https://example.com/refunds", contentHash: "sha256:report-source" });
    expect(Object.isFrozen(report.sourceProvenance)).toBe(true);
  });
});
