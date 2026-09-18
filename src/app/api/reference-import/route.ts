import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { BlockList, isIP } from "node:net";
import { checkServerIdentity } from "node:tls";

import { NextResponse } from "next/server";

import { extractFaqContent } from "./extract-faq";
import { clientKeyOf, createRateLimiter, rateLimitingEnabled } from "../../../lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 5_000;

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
    const extraction = extractFaqContent(html);
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
