import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = "http://127.0.0.1:3100";
const out = ".impeccable/review";
fs.mkdirSync(out, { recursive: true });

const faq = `Q: When will my order arrive?
A: Standard delivery takes 3 to 5 business days from dispatch.

Q: What if my delivery is late?
A: Check the tracking link first. If the delivery window has passed, contact support and we will escalate the order to the carrier.

Q: When is a refund available?
A: Refunds are available within 30 days for unopened items. Opened items can be exchanged only.`;

const browser = await chromium.launch();

async function seedAndCapture(width, height, dpr, tag) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  await page.goto(`${base}/`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${tag}-home.png`, fullPage: true });
  await page.goto(`${base}/setup`);
  await page.waitForTimeout(700);
  await page.getByLabel("Company name").fill("Northwind Telecom");
  await page.getByLabel("FAQ or policy text").fill(faq);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${tag}-setup.png`, fullPage: true });
  await page.getByRole("button", { name: "Confirm this source" }).click();
  await page.getByRole("button", { name: "Start practice call" }).click();
  await page.waitForURL("**/call");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${tag}-call.png`, fullPage: true });
  const status = await page.evaluate(async () => {
    const context = JSON.parse(localStorage.getItem("supportcoach.current-practice-session"));
    const iso = (offset) => new Date(Date.now() - offset * 45000).toISOString();
    const transcript = [
      { id: "customer-1", speaker: "customer", text: "Where is my order? I ordered a week ago and nothing has arrived.", source: "mock-transcript", startedAt: iso(10), endedAt: iso(10) },
      { id: "trainee-1", speaker: "trainee", text: "I am sorry your delivery is late. Standard delivery takes 3 to 5 business days, and your order is past that window, so I have escalated it to the carrier and sent you the tracking link.", source: "live-transcript", startedAt: iso(8), endedAt: iso(8) },
      { id: "customer-2", speaker: "customer", text: "This is really frustrating. Can I just get a refund?", source: "mock-transcript", startedAt: iso(6), endedAt: iso(6) },
      { id: "trainee-2", speaker: "trainee", text: "I completely understand. Refunds are available within 30 days for unopened items, so I can process a full refund for you today.", source: "live-transcript", startedAt: iso(4), endedAt: iso(4) },
    ];
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, sourceContentHash: context.sourceContentHash, facts: context.facts, transcript }),
    });
    const report = await response.json();
    localStorage.setItem("supportcoach.completed-practice.v1", JSON.stringify({ context, report }));
    return response.status;
  });
  await page.goto(`${base}/report`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${tag}-report.png`, fullPage: true });
  console.log(tag, "evaluate:", status);
  await page.close();
}

await seedAndCapture(1440, 900, 1, "desktop");
await seedAndCapture(390, 844, 2, "mobile");

await browser.close();
console.log("done");
