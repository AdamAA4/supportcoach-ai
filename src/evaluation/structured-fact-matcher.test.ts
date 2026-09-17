import { describe, expect, it } from "vitest";
import type { ReferenceFact } from "../domain/reference-source";
import { compileFactMatchSpecs } from "./structured-fact-matcher";

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
