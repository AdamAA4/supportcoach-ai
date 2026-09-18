import { describe, expect, it } from "vitest";
import type { ReferenceFact } from "../domain/reference-source";
import { compileFactMatchSpecs, matchReferenceFacts } from "./structured-fact-matcher";

const fact = (id: string, answer: string, keywords: string[] = []): ReferenceFact => ({
  id,
  question: `${id}?`,
  answer,
  keywords,
  source: "policy",
});

describe("compileFactMatchSpecs", () => {
  it("separates shared subjects from discriminating relations and values", () => {
    const specs = compileFactMatchSpecs([
      fact("eligibility", "Refunds are available within 30 days for unopened items"),
      fact("processing", "Refunds are processed within 5 business days"),
    ]);

    expect(specs.get("eligibility")).toEqual({
      subjectTerms: ["refunds"],
      relationTerms: ["available", "items"],
      valueTerms: ["30", "days"],
      conditionTerms: ["within", "unopened"],
      requiredTerms: ["refunds", "available", "within", "30", "days", "unopened", "items"],
    });
    expect(specs.get("processing")).toEqual({
      subjectTerms: ["refunds"],
      relationTerms: ["processed"],
      valueTerms: ["5", "business", "days"],
      conditionTerms: ["within"],
      requiredTerms: ["refunds", "processed", "within", "5", "business", "days"],
    });
  });

  it("retains a conjunction-required subject and returns a conservative fallback", () => {
    const specs = compileFactMatchSpecs([
      fact("combined", "Refunds and exchanges are processed within 5 days"),
      fact("exchange", "Exchanges are processed within 5 days"),
      fact("availability", "Exchanges are available within 30 days"),
    ]);

    expect(specs.get("combined")?.requiredTerms).toEqual([
      "refunds", "exchanges", "processed", "within", "5", "days",
    ]);
    expect(specs.get("combined")?.subjectTerms).toEqual(["refunds", "exchanges"]);
    expect(specs.get("availability")?.relationTerms).toContain("available");
  });
});

describe("matchReferenceFacts", () => {
  const eligibility = fact("eligibility", "Refunds are available within 30 days for unopened items");
  const processing = fact("processing", "Refunds are processed within 5 business days");

  it.each([
    ["Refunds are available within 30 days for all items.", false, true],
    ["Refunds are available within 30 days for unopened items regardless of payment method.", true, false],
    ["Not all refunds are available within 30 days for unopened items.", false, false],
    ["Refunds are available within 30 days for unopened items, the support team checks the order in 2 minutes.", true, false],
  ])("anchors condition, polarity, and numeric evidence to the relation: %s", (text, supported, conflict) => {
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds).toEqual(new Set(supported ? [eligibility.id] : []));
    expect(result.unsupportedClaims).toEqual(conflict ? [text] : []);
  });

  it.each([
    "Refunds are available within 30 days for unopened items and refunds are processed within 5 business days.",
    "Refunds are processed within 5 business days and refunds are available within 30 days for unopened items.",
  ])("supports two correct same-subject claims: %s", (text) => {
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect([...result.supportedFactIds]).toEqual(expect.arrayContaining([eligibility.id, processing.id]));
    expect(result.unsupportedClaims).toEqual([]);
  });

  it.each([
    "Refunds are available within 30 days for unopened items and refunds are processed within 15 business days.",
    "Refunds are processed within 15 business days and refunds are available within 30 days for unopened items.",
  ])("credits the correct claim and flags only the conflicting claim: %s", (text) => {
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.supportedFactIds.has(processing.id)).toBe(false);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it("covers required terms pooled across the fact's own comma-separated clauses", () => {
    const affiliate = fact("affiliate", "To register as an affiliate, submit the application form from your dashboard and provide your payout details");
    const text = "To register as an affiliate, submit the application form from your dashboard and provide your payout details.";
    const result = matchReferenceFacts([affiliate], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(affiliate.id)).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("does not cut a fact's own subject when a sibling fact uses the same word as a relation", () => {
    const delivery = fact("delivery", "Standard delivery takes 3 to 5 business days from dispatch");
    const late = fact("late", "Check the tracking link first. If the delivery window has passed, contact support and we will escalate the order to the carrier.");
    const text = "Standard delivery takes 3 to 5 business days from dispatch, and your order is past that window, so we have escalated it to the carrier and sent you the tracking link.";
    const result = matchReferenceFacts([delivery, late], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(delivery.id)).toBe(true);
  });

  it("supports an equivalent confirmed negative fact phrased with a contraction", () => {
    const negative = fact("negative", "Refunds are not available after 30 days");
    const text = "Refunds aren't available after 30 days.";
    const result = matchReferenceFacts([negative], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(negative.id)).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("preserves a conjunction required by one fact", () => {
    const combined = fact("combined", "Refunds and exchanges are processed within 5 days");
    const exchange = fact("exchange", "Exchanges are processed within 5 days");
    const availability = fact("availability", "Exchanges are available within 30 days");
    const text = combined.answer;
    const result = matchReferenceFacts([combined, exchange, availability], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(combined.id)).toBe(true);
    expect(result.supportedFactIds.has(availability.id)).toBe(false);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("treats an incomplete relevant statement as missed without inventing a conflict", () => {
    const text = "Refunds are available.";
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it.each([
    "Refunds aren't available within 30 days for unopened items.",
    "Refunds are available within 30 days for opened items.",
    "Refunds are always available for all items.",
    "Refunds are available for all items.",
  ])("flags an explicit condition conflict: %s", (text) => {
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it("retains a leading negator in the fact-local claim window", () => {
    const text = "No refunds are available within 30 days for unopened items.";
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it.each([
    "No exchanges or refunds are available within 30 days for unopened items.",
    "No customer refunds are available within 30 days for unopened items.",
    "Under no circumstances are refunds available within 30 days for unopened items.",
  ])("retains negation scope through pre-subject modifiers: %s", (text) => {
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it("does not mistake all restricted items for removal of the restriction", () => {
    const text = "Refunds are available within 30 days for all unopened items.";
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("treats a preserved item restriction with an omitted time limit as ambiguous", () => {
    const text = "Refunds are available for all unopened items.";
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("keeps an extra number in a separate statement out of a supported fact", () => {
    const reassurance = "I can check that for you in 2 minutes.";
    const result = matchReferenceFacts([eligibility], [
      { text: eligibility.answer, isQuestion: false },
      { text: reassurance, isQuestion: false },
    ]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("keeps an unrelated numeric detail in a later independent clause out of the fact", () => {
    const text = "Refunds are available within 30 days for unopened items, and I can check the order in 2 minutes.";
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it.each([
    "Refunds are available within 30 days for unopened items while I can check the order in 2 minutes.",
    "Refunds are available within 30 days for unopened items but I can check the order in 2 minutes.",
    "Refunds are available within 30 days for unopened items, I can check the order in 2 minutes.",
    "Refunds are available within 30 days for unopened items, the support team can check the order in 2 minutes.",
  ])("isolates an independent clause without relying on comma-and: %s", (text) => {
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("preserves valid comma-coordinated same-subject facts", () => {
    const text = "Refunds are available within 30 days for unopened items, refunds are processed within 5 business days.";
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect([...result.supportedFactIds]).toEqual(expect.arrayContaining([eligibility.id, processing.id]));
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("does not use a question as factual support or conflict", () => {
    const text = "Are refunds available within 60 days for opened items?";
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: true }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("does not treat unrelated negative reassurance as a conflict", () => {
    const text = `${eligibility.answer}. You are not alone.`;
    const result = matchReferenceFacts([eligibility], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("keeps reversed same-subject values unsupported", () => {
    const text = "Refunds are available within 5 days for unopened items and refunds are processed within 30 business days.";
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it("does not create a cross-sentence conflict for two correct facts", () => {
    const result = matchReferenceFacts([eligibility, processing], [
      { text: eligibility.answer, isQuestion: false },
      { text: processing.answer, isQuestion: false },
    ]);
    expect([...result.supportedFactIds]).toEqual(expect.arrayContaining([eligibility.id, processing.id]));
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("keeps same-subject same-relation values ambiguous without inventing a conflict", () => {
    const short = fact("short", "Refunds take 5 days");
    const long = fact("long", "Refunds take 10 days");
    const text = "Refunds take 5 days and refunds take 10 days.";
    const result = matchReferenceFacts([short, long], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("credits one correct fact while deduplicating two conflicting values for another", () => {
    const text = "Refunds are available within 30 days for unopened items and refunds are processed within 15 or 20 business days.";
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.has(eligibility.id)).toBe(true);
    expect(result.supportedFactIds.has(processing.id)).toBe(false);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it("deduplicates one statement containing two explicit conflicting values", () => {
    const text = "Refunds are available within 15 days for unopened items and refunds are processed within 20 business days.";
    const result = matchReferenceFacts([eligibility, processing], [{ text, isQuestion: false }]);
    expect(result.supportedFactIds.size).toBe(0);
    expect(result.unsupportedClaims).toEqual([text]);
  });

  it("uses conservative full-statement matching when no relation term is available", () => {
    const sparse = fact("sparse", "Refunds within 30 days");
    const correct = matchReferenceFacts([sparse], [{ text: sparse.answer, isQuestion: false }]);
    const incomplete = matchReferenceFacts([sparse], [{ text: "Refunds within.", isQuestion: false }]);
    expect(correct.supportedFactIds.has(sparse.id)).toBe(true);
    expect(correct.unsupportedClaims).toEqual([]);
    expect(incomplete.supportedFactIds.size).toBe(0);
    expect(incomplete.unsupportedClaims).toEqual([]);
  });

  it("allows one confirmed answer to entail its duplicate subset fact", () => {
    const combined = fact("combined", "Refunds and exchanges are processed within 5 days");
    const subset = fact("subset", "Exchanges are processed within 5 days");
    const result = matchReferenceFacts([combined, subset], [{ text: combined.answer, isQuestion: false }]);
    expect([...result.supportedFactIds]).toEqual(expect.arrayContaining([combined.id, subset.id]));
    expect(result.unsupportedClaims).toEqual([]);
  });
});
