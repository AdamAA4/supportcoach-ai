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

  it("extracts grounded question and answer text from Framer rich-text state", () => {
    const html = `<main><h2>Subscribe to our newsletter</h2><p>Send</p></main><script>window.__framer = "[4,\\"h2\\",{\\"dir\\":\\"auto\\"},[5,\\"Am I required to verify my KYC every time I complete the challenge?\\"]],[4,\\"p\\",{\\"dir\\":\\"auto\\"},[5,\\"KYC is only required for the first challenge you pass. Once your identity is verified and approved, you won’t need to complete the KYC process again for future challenges you pass.\\"]]";</script>`;
    const result = extractFaqContent(html);

    expect(result.extractedText).toContain("Q: Am I required to verify my KYC every time I complete the challenge?");
    expect(result.extractedText).toContain("A: KYC is only required for the first challenge you pass.");
    expect(result.extractedText).not.toContain("Subscribe to our newsletter");
  });
});

describe("Intercom help centers", () => {
  it("fails closed when an identified article has no readable article body", () => {
    const html = `<script id="__NEXT_DATA__">${JSON.stringify({ page: "/[helpCenterIdentifier]/[locale]/articles/[articleSlug]" })}</script><h1>Payout</h1><p>Updated over a month ago. Table of contents.</p>`;
    expect(extractFaqContent(html).qaPairs).toBe(0);
    expect(harvestFaqCorpus(html).corpus).toBe("");
  });
  it("extracts only the article body, excluding duplicate title metadata and footer", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ page: "/[helpCenterIdentifier]/[locale]/articles/[articleSlug]", props: { pageProps: { articleContent: {} } } })}</script>
      <div class="article intercom-force-break"><h1>How do payouts work?</h1><p>Payout Rules, Profit Split & Reward Caps</p><time>Updated over a month ago</time><p>Table of contents</p>
      <div class="article_body"><article><h2>How do payouts work?</h2><p>Traders become eligible after 14 calendar days.</p><h2>Payout Processing Fee</h2><p>All payouts have a 3% processing fee.</p></article></div></div>
      <fieldset>Did this answer your question?</fieldset><footer>All Collections</footer>`;
    const result = extractFaqContent(html);
    expect(result.qaPairs).toBe(2);
    expect(result.extractedText).toContain("A: Traders become eligible after 14 calendar days.");
    expect(result.extractedText).not.toMatch(/Updated|Table of contents|Reward Caps|Did this answer|All Collections/);
    expect(harvestFaqCorpus(html).corpus).not.toMatch(/Updated|Table of contents|Reward Caps|Did this answer|All Collections/);
  });

  it.each(["landing", "collections/[collectionSlug]"])("does not treat a %s directory as policy evidence", (page) => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ page: `/[helpCenterIdentifier]/[locale]/${page}`, props: { pageProps: {} } })}</script><h2>Payout</h2><p>10 articles. Payout rules and payment methods. Updated over a month ago.</p>`;
    expect(extractFaqContent(html)).toEqual({ extractedText: "", qaPairs: 0, structured: false });
    expect(harvestFaqCorpus(html).corpus).toBe("");
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

  it("discovers nested relative article links when a hub uses a file-like path", () => {
    const html = [
      `<a href="./general/how-does-the-kyc-verification-work">KYC</a>`,
      `<a href="./general/slippage">Slippage</a>`,
      `<a href="./contact">Contact</a>`,
    ].join("");
    expect(extractSameOriginLinks(html, new URL("https://equityedge.io/faq"), 8)).toEqual([
      "https://equityedge.io/general/how-does-the-kyc-verification-work",
      "https://equityedge.io/general/slippage",
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
