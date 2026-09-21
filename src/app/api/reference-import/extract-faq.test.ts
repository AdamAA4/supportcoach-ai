import { describe, expect, it } from "vitest";
import { extractFaqContent, extractSameOriginLinks, harvestFaqCorpus } from "./extract-faq";

describe("extractFaqContent", () => {
  it("extracts question/answer pairs from FAQPage JSON-LD structured data", () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"When will my order arrive?","acceptedAnswer":{"@type":"Answer","text":"Standard delivery takes 3 to 5 business days."}},{"@type":"Question","name":"How do I track my parcel?","acceptedAnswer":{"@type":"Answer","text":"Use the tracking link from your dispatch email."}}]}</script></head><body><p>Contact us</p></body></html>`;
    const result = extractFaqContent(html);
    expect(result.structured).toBe(true);
    expect(result.qaPairs).toBe(2);
    expect(result.extractedText).toContain("Q: When will my order arrive?");
    expect(result.extractedText).toContain("A: Standard delivery takes 3 to 5 business days.");
    expect(result.extractedText).toContain("Q: How do I track my parcel?");
  });

  it("extracts pairs from details/summary accordions and keeps section boundaries", () => {
    const html = `<main>
      <details><summary>When will my order arrive?</summary><p>Standard delivery takes 3 to 5 business days.</p></details>
      <details><summary>Can I cancel an order?</summary><p>Orders can be cancelled before dispatch.</p></details>
    </main>`;
    const result = extractFaqContent(html);
    expect(result.qaPairs).toBe(2);
    expect(result.extractedText).toBe(
      "Q: When will my order arrive?\nA: Standard delivery takes 3 to 5 business days.\n\nQ: Can I cancel an order?\nA: Orders can be cancelled before dispatch.",
    );
  });

  it("extracts pairs from definition lists", () => {
    const html = `<dl><dt>What is slippage?</dt><dd>Slippage is the difference between the expected and executed price.</dd><dt>Is there a minimum deposit?</dt><dd>The minimum deposit is 100 dollars.</dd></dl>`;
    const result = extractFaqContent(html);
    expect(result.structured).toBe(true);
    expect(result.qaPairs).toBe(2);
    expect(result.extractedText).toContain("Q: What is slippage?");
    expect(result.extractedText).toContain("A: The minimum deposit is 100 dollars.");
  });

  it("treats headings plus following content as question/answer sections", () => {
    const html = `<main><h2>When will my order arrive?</h2><p>Standard delivery takes 3 to 5 business days.</p><h2>What if my delivery is late?</h2><ul><li>Check the tracking link.</li><li>Contact support after the window.</li></ul></main>`;
    const result = extractFaqContent(html);
    expect(result.qaPairs).toBe(2);
    expect(result.extractedText).toContain("Q: When will my order arrive?");
    expect(result.extractedText).toContain("A: Standard delivery takes 3 to 5 business days.");
    expect(result.extractedText).toContain("Q: What if my delivery is late?");
    expect(result.extractedText).toContain("A: Check the tracking link.\nContact support after the window.");
  });

  it("drops exact duplicate entries and keeps distinct questions with the same answer", () => {
    const html = `<main>
      <details><summary>When will my order arrive?</summary><p>Standard delivery takes 3 to 5 business days.</p></details>
      <details><summary>When will my order  arrive?</summary><p>Standard delivery takes 3 to 5 business days.</p></details>
      <details><summary>Refund window</summary><p>Standard delivery takes 3 to 5 business days.</p></details>
    </main>`;
    const result = extractFaqContent(html);
    expect(result.qaPairs).toBe(2);
    expect(result.extractedText.match(/Q: /g)).toHaveLength(2);
    expect(result.extractedText).toContain("Q: Refund window");
  });

  it("falls back to plain sections and flags the page as unstructured when no heading or Q/A shape exists", () => {
    const html = `<main><p>Standard delivery takes 3 to 5 business days.</p><p>Tracking links are sent by email.</p></main>`;
    const result = extractFaqContent(html);
    expect(result.structured).toBe(false);
    expect(result.qaPairs).toBe(0);
    expect(result.extractedText).toContain("Standard delivery takes 3 to 5 business days.");
    expect(result.extractedText).toContain("Tracking links are sent by email.");
  });

  it("splits a banner heading section into one pair per embedded question", () => {
    const html = `<main><h1>Frequently asked questions</h1><p>Everything you need to know before trading.</p><p>How does the KYC verification work?</p><p>Submit your documents and verification completes within 24 hours.</p><p>What is slippage?</p><p>Slippage is the price difference between the expected and executed price.</p></main>`;
    const result = extractFaqContent(html);
    expect(result.qaPairs).toBe(2);
    expect(result.extractedText).toContain("Q: How does the KYC verification work?\nA: Submit your documents and verification completes within 24 hours.");
    expect(result.extractedText).toContain("Q: What is slippage?\nA: Slippage is the price difference between the expected and executed price.");
    expect(result.extractedText).not.toContain("Q: Frequently asked questions");
  });

  it("keeps a question heading with a plain multi-paragraph answer as one pair", () => {
    const html = `<main><h2>What if my delivery is late?</h2><p>Check the tracking link first.</p><p>If the delivery window has passed, contact support and we will escalate the order to the carrier.</p></main>`;
    const result = extractFaqContent(html);
    expect(result.qaPairs).toBe(1);
    expect(result.extractedText).toContain("Q: What if my delivery is late?");
    expect(result.extractedText).toContain("Check the tracking link first.\nIf the delivery window has passed");
  });

  it("does not pair consecutive menu labels as question and answer", () => {
    const html = `<main><h1>Frequently asked questions</h1><p>How to Secure Funding from Equity Edge</p><p>Evaluation Phase</p><p>Crypto Trading over the weekend</p><p>How does the KYC verification work?</p><p>Slippage</p><p>Restricted Countries</p><p>Policy Against Gambling in Trading</p></main>`;
    const result = extractFaqContent(html);
    expect(result.extractedText).not.toContain("A: Evaluation Phase");
    expect(result.extractedText).not.toContain("A: Slippage");
    // The section is kept as one entry with its content preserved.
    expect(result.extractedText).toContain("How does the KYC verification work?");
    expect(result.extractedText).toContain("Policy Against Gambling in Trading");
  });

  it("harvests FAQ text embedded in Next.js-style inline scripts", () => {
    const html = `<html><body><p>Menu: evaluations, funding.</p><script>self.__next_f.push([1,"How does the KYC verification work? Submit your documents and verification completes within 24 hours."])</script></body></html>`;
    const { corpus } = harvestFaqCorpus(html);
    expect(corpus).toContain("How does the KYC verification work?");
    expect(corpus).toContain("verification completes within 24 hours");
  });
});

describe("extractSameOriginLinks", () => {
  const hub = new URL("https://equityedge.io/faq/");

  it("discovers same-origin article links inside the hub's path", () => {
    const html = `<a href="/faq/general">General</a><a href="/faq/trading-rules">Trading Rules</a>`;
    expect(extractSameOriginLinks(html, hub, 8)).toEqual([
      "https://equityedge.io/faq/general",
      "https://equityedge.io/faq/trading-rules",
    ]);
  });

  it("skips the hub itself, other hosts, assets, and duplicates", () => {
    const html = [
      `<a href="/faq/">Hub</a>`,
      `<a href="/faq/one">One</a>`,
      `<a href="/faq/one">One again</a>`,
      `<a href="https://other.example/faq/external">External</a>`,
      `<a href="http://equityedge.io/faq/http">Insecure</a>`,
      `<a href="/files/rules.pdf">PDF</a>`,
    ].join("");
    expect(extractSameOriginLinks(html, hub, 8)).toEqual(["https://equityedge.io/faq/one"]);
  });

  it("stops at the cap", () => {
    const html = Array.from({ length: 5 }, (_, index) => `<a href="/faq/page-${index}">P${index}</a>`).join("");
    expect(extractSameOriginLinks(html, hub, 3)).toHaveLength(3);
  });
});
