import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { BlockList, isIP } from "node:net";
import { checkServerIdentity } from "node:tls";

import { NextResponse } from "next/server";

import { extractFaqContent, extractSameOriginLinks, harvestFaqCorpus } from "./extract-faq";
import { extractPairsWithLlm, isLlmConfigured } from "./llm";
import { verifyGroundedPairs } from "./grounding";
import { clientKeyOf, createRateLimiter, rateLimitingEnabled } from "../../../lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 5_000;
const MAX_ARTICLE_PAGES = 8;
const PAGES_TIMEOUT_MS = 12_000;

type ImportFailure = "invalid" | "too-large" | "unavailable";

const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const failure = (kind: ImportFailure, measuredBytes?: number) => {
  const payload = kind === "invalid"
    ? { status: 400, code: "invalid_reference_url", message: "Enter a public HTTPS URL." }
    : kind === "too-large"
      ? {
          status: 413,
          code: "reference_too_large",
          message: measuredBytes
            ? `This page is ${formatMb(measuredBytes)}, over the 2 MB import limit. Open the page, copy the FAQ or policy text, and paste it instead.`
            : "This page is over the 2 MB import limit. Open the page, copy the FAQ or policy text, and paste it instead.",
        }
      : { status: 502, code: "reference_unavailable", message: "The reference source could not be imported." };
  return NextResponse.json({ error: { code: payload.code, message: payload.message } }, { status: payload.status });
};

const nonpublic = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) nonpublic.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) nonpublic.addSubnet(address, prefix, "ipv6");
const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");

// Node parses equivalent IPv6 spellings, including IPv4-mapped addresses.
// Fail closed outside global unicast; transition, local and reserved IPv6 are refused.
const isPublicAddress = (address: string): boolean => {
  const family = isIP(address);
  if (!family) return false;
  if (family === 4) return !nonpublic.check(address, "ipv4");
  return globalIpv6.check(address, "ipv6") && !nonpublic.check(address, "ipv6");
};

const hostnameOf = (url: URL) => url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");

const publicHttpsUrl = (value: unknown): URL | undefined => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return undefined;
    const hostname = hostnameOf(url).toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || (isIP(hostname) && !isPublicAddress(hostname))) return undefined;
    return url;
  } catch {
    return undefined;
  }
};

// Structured FAQ extraction (JSON-LD, details/summary, definition lists,
// heading sections) plus the text fallback lives in ./extract-faq so it can
// be tested directly. Block-level closers become newlines so paragraph
// structure survives for the fact extractor.
const readBoundedBody = async (response: IncomingMessage): Promise<{ html: string; bytes: number }> => {
  const advertisedLength = Number(response.headers["content-length"]);
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_BYTES) {
    response.destroy();
    throw Object.assign(new Error("too-large"), { measuredBytes: advertisedLength });
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const bytes = Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_BYTES) { response.destroy(); throw new Error("too-large"); }
    chunks.push(bytes);
  }
  return { html: Buffer.concat(chunks, size).toString("utf8"), bytes: size };
};

const resolvePublicAddress = async (url: URL): Promise<string> => {
  const hostname = hostnameOf(url);
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) throw new Error("invalid");
  return addresses[0].address;
};

const retrieve = (url: URL, address: string, signal: AbortSignal): Promise<{ html: string; bytes: number }> => new Promise((resolve, reject) => {
  const hostname = hostnameOf(url);
  // The connection uses a validated numeric IP, so it cannot perform a second DNS
  // lookup. Host, SNI and certificate verification retain the requested identity.
  const request = httpsRequest({
    hostname: address, port: url.port || 443, path: `${url.pathname}${url.search}`, method: "GET",
    headers: { Host: url.host, "Accept-Encoding": "identity" },
    servername: isIP(hostname) ? "" : hostname,
    checkServerIdentity: (_host, certificate) => checkServerIdentity(hostname, certificate),
    rejectUnauthorized: true, agent: false, signal,
  }, (response) => {
    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
      response.destroy(); reject(new Error("unavailable")); return;
    }
    void readBoundedBody(response).then(resolve, reject);
  });
  request.on("error", reject);
  request.end();
});

const importRateLimiter = createRateLimiter(60_000, 10);
const tooManyRequests = (retryAfterSeconds: number) => NextResponse.json(
  { error: { code: "rate_limited", message: "Too many import requests. Try again shortly." } },
  { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
);

export async function POST(request: Request) {
  if (rateLimitingEnabled()) {
    const decision = importRateLimiter(clientKeyOf(request));
    if (!decision.allowed) return tooManyRequests(decision.retryAfterSeconds);
  }
  let sourceUrl: URL | undefined;
  try {
    const body: unknown = await request.json();
    sourceUrl = publicHttpsUrl((body as { url?: unknown })?.url);
  } catch {
    return failure("invalid");
  }
  if (!sourceUrl) return failure("invalid");

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, TIMEOUT_MS);
  });
  try {
    const address = await Promise.race([resolvePublicAddress(sourceUrl), deadline]);
    const { html, bytes } = await Promise.race([retrieve(sourceUrl, address, controller.signal), deadline]);
    // Stage 1: harvest every scrap of text the page contains (visible,
    // JSON-LD, and strings embedded in inline scripts).
    const harvest = harvestFaqCorpus(html);
    // Stage 2a: deterministic structure-based extraction (also the fallback).
    let extraction = extractFaqContent(html);
    let extractionSource: "llm" | "basic" = "basic";
    const corpusParts = [harvest.corpus];
    const pages: Array<{ url: string; status: string }> = [{ url: sourceUrl.pathname, status: "ok" }];
    let pagesRead = 1;
    const articleExtractions: Array<ReturnType<typeof extractFaqContent>> = [];

    // FAQ hubs often only LIST their content: the real answers live on
    // same-origin article pages linked from the hub. Read them with a
    // bounded, parallel, per-URL-validated pass (no redirects, no external
    // hosts, no asset extensions, capped page count and total time).
    const articleLinks = extractSameOriginLinks(html, sourceUrl, MAX_ARTICLE_PAGES);
    if (articleLinks.length > 0) {
      const pagesController = new AbortController();
      const pagesTimer = setTimeout(() => pagesController.abort(), PAGES_TIMEOUT_MS);
      try {
        const attempts = articleLinks.map((link) => (async () => {
          const pageUrl = new URL(link);
          try {
            const pageAddress = await Promise.race([
              resolvePublicAddress(pageUrl),
              new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("pages-timeout")), PAGES_TIMEOUT_MS); timer.unref?.(); }),
            ]);
            const fetched = await Promise.race([
              retrieve(pageUrl, pageAddress, pagesController.signal),
              new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("pages-timeout")), PAGES_TIMEOUT_MS); timer.unref?.(); }),
            ]);
            return { url: pageUrl.pathname, html: fetched.html, failed: false };
          } catch {
            return { url: pageUrl.pathname, html: "", failed: true };
          }
        })());
        const settled = await Promise.allSettled(attempts);
        for (const entry of settled) {
          const outcome = entry.status === "fulfilled" ? entry.value : { url: "unreachable page", html: "", failed: true };
          if (outcome.failed) { pages.push({ url: outcome.url, status: "failed" }); continue; }
          pagesRead += 1;
          pages.push({ url: outcome.url, status: "ok" });
          corpusParts.push(harvestFaqCorpus(outcome.html).corpus);
          const pageExtraction = extractFaqContent(outcome.html);
          if (pageExtraction.structured) {
            articleExtractions.push(pageExtraction);
          }
        }
      } finally {
        clearTimeout(pagesTimer);
      }
    }

    // A hub often contains only topic labels. Once linked articles provide
    // complete pairs, use those articles as the source of truth instead of
    // combining them with the hub's menu text.
    if (articleExtractions.length > 0) {
      extraction = {
        extractedText: articleExtractions.map((article) => article.extractedText).join("\n\n"),
        qaPairs: articleExtractions.reduce((total, article) => total + article.qaPairs, 0),
        structured: true,
      };
    }

    // Stage 2b: optional AI-assisted read of the full corpus. It is a rescue
    // path only when deterministic extraction found no complete pairs, so a
    // valid linked-article import stays within the bounded import deadline.
    // Its pairs are verified against harvested text; anything invented is
    // dropped, and any provider failure falls back silently to basic.
    if (!extraction.structured && isLlmConfigured()) {
      try {
        const llmPairs = verifyGroundedPairs(
          await extractPairsWithLlm(corpusParts.join("\n\n")),
          corpusParts.join("\n\n"),
        );
        if (llmPairs.length > 0) {
          extraction = {
            extractedText: llmPairs.map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`).join("\n\n"),
            qaPairs: llmPairs.length,
            structured: true,
          };
          extractionSource = "llm";
        }
      } catch { /* AI-assisted extraction unavailable: basic extraction already covers the pages */ }
    }
    const extractedText = extraction.extractedText;
    if (!extractedText) return failure("unavailable");
    const canonicalUrl = sourceUrl.toString();
    return NextResponse.json({
      canonicalUrl,
      extractedText,
      contentHash: `sha256:${createHash("sha256").update(extractedText).digest("hex")}`,
      pageBytes: bytes,
      qaPairs: extraction.qaPairs,
      structured: extraction.structured,
      extractionSource,
      pagesRead,
      pages: pages.slice(0, 12),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "too-large") {
      const measuredBytes = (error as Error & { measuredBytes?: number }).measuredBytes;
      return failure("too-large", measuredBytes);
    }
    return failure(error instanceof Error && error.message === "invalid" ? "invalid" : "unavailable");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
