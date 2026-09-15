import { describe, expect, it } from "vitest";

import {
  PRACTICE_SCENARIOS,
  SCORE_DIMENSIONS,
  validatePracticePack,
} from "../../src/domain/practice-pack";

describe("practice-pack contract", () => {
  it("accepts a confirmed pasted policy source with approved practice advice", () => {
    const result = validatePracticePack({
      source: {
        kind: "pasted-text",
        text: "Refunds are available within 30 days for unopened items.",
        confirmation: "confirmed",
      },
      notes: {
        content: "Ask the customer to confirm their order number.",
        format: "markdown",
        classification: "approved-practice-advice",
      },
      scenario: "refund-eligibility",
    });

    expect(result).toEqual({ ok: true });
  });

  it("requires a non-empty public HTTPS link or pasted source for every session", () => {
    expect(
      validatePracticePack({
        source: { kind: "public-https-link", url: "http://example.com/faq", confirmation: "confirmed" },
        scenario: "late-delivery",
      }),
    ).toEqual({
      ok: false,
      issues: ["A public HTTPS link or pasted FAQ/policy text is required."],
    });

    expect(
      validatePracticePack({
        source: { kind: "pasted-text", text: "   ", confirmation: "confirmed" },
        scenario: "late-delivery",
      }),
    ).toEqual({
      ok: false,
      issues: ["A public HTTPS link or pasted FAQ/policy text is required."],
    });
  });

  it("requires the extracted source snapshot to be confirmed before practice", () => {
    expect(
      validatePracticePack({
        source: {
          kind: "public-https-link",
          url: "https://example.com/faq",
          confirmation: "pending",
        },
        scenario: "late-delivery",
      }),
    ).toEqual({
      ok: false,
      issues: ["Confirm the source snapshot before starting practice."],
    });
  });

  it("rejects note content without an allowed format", () => {
    expect(
      validatePracticePack({
        source: { kind: "pasted-text", text: "Delivery policy", confirmation: "confirmed" },
        notes: {
          content: "Useful context",
          format: "pdf" as "markdown",
          classification: "personal-coaching-note",
        },
        scenario: "late-delivery",
      }),
    ).toEqual({
      ok: false,
      issues: ["Experience notes must be plain text or Markdown."],
    });
  });

  it("rejects note content without an approved classification", () => {
    expect(
      validatePracticePack({
        source: { kind: "pasted-text", text: "Delivery policy", confirmation: "confirmed" },
        notes: {
          content: "Useful context",
          format: "plain-text",
          classification: "team-tip" as "personal-coaching-note",
        },
        scenario: "late-delivery",
      }),
    ).toEqual({
      ok: false,
      issues: [
        "Experience notes must be approved practice advice or a personal coaching note.",
      ],
    });
  });

  it("publishes exactly the two approved scenarios and four-score rubric", () => {
    expect(PRACTICE_SCENARIOS).toEqual(["late-delivery", "refund-eligibility"]);
    expect(SCORE_DIMENSIONS).toEqual([
      "factual-accuracy",
      "empathy",
      "clarity",
      "resolution",
    ]);
  });
});
