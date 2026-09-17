import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = "http://127.0.0.1:3100";
const out = ".impeccable/review";
fs.mkdirSync(out, { recursive: true });

const faq = `Q: When will my order arrive?
A: Standard delivery takes 3 to 5 business days from dispatch.

Q: What if my delivery is late?
A: Check the tracking link first. If the delivery window has passed, contact support and we will escalate the order to the carrier.`;

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

async function liveCapture(width, height, dpr, tag) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  await page.goto(`${base}/setup`);
  await page.getByLabel("Company name").fill("Northwind Telecom");
  await page.getByLabel("FAQ or policy text").fill(faq);
  await page.getByRole("button", { name: "Confirm this source" }).click();
  await page.getByRole("button", { name: "Start practice call" }).click();
  await page.waitForURL("**/call");
  await page.getByRole("button", { name: "Join voice call" }).click();
  // Wait for the live state: REC badge appears once the session is live
  await page.getByText("Rec", { exact: true }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${tag}-call-live.png`, fullPage: false });
  const state = await page.evaluate(() => document.querySelector("main")?.textContent?.slice(0, 300));
  console.log(tag, "live capture ok. state snippet:", state?.match(/Microphone: [^C]+/)?.[0]);
  await page.close();
}

await liveCapture(1440, 900, 1, "desktop");
await liveCapture(390, 844, 2, "mobile");
await browser.close();
console.log("done");
