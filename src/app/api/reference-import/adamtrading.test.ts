// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractFaqContent } from "./extract-faq";
import { normalizeReferenceFacts } from "../../../domain/reference-source";

it("imports all 22 original ADAMTRADING rules without demo notices or navigation facts", () => {
  const html = readFileSync("public/adamtrading-faq.html", "utf8");
  const extracted = extractFaqContent(html);
  expect(extracted.qaPairs).toBe(22);
  expect(extracted.structured).toBe(true);
  expect(normalizeReferenceFacts(extracted.extractedText, [])).toHaveLength(22);
  expect(extracted.extractedText).toContain("A: The demo evaluation requires a 10% profit");
  expect(extracted.extractedText).not.toMatch(/Version 1.0|30 September|original practice questions|Fictional demo only/);
  expect(html).toContain("No deposits are required and no real-money rewards are paid.");
});
