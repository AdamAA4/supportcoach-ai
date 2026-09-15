import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 5_000;

type ImportFailure = "invalid" | "too-large" | "unavailable";

const failure = (kind: ImportFailure) => {
  const payload = kind === "invalid"
    ? { status: 400, code: "invalid_reference_url", message: "Enter a public HTTPS URL." }
    : kind === "too-large"
      ? { status: 413, code: "reference_too_large", message: "The reference source must be 200 KB or smaller." }
      : { status: 502, code: "reference_unavailable", message: "The reference source could not be imported." };
  return NextResponse.json({ error: { code: payload.code, message: payload.message } }, { status: payload.status });
};

const isPrivateIpv4 = (address: string): boolean => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19));
};

const isPrivateAddress = (address: string): boolean => {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.includes(".")) return isPrivateIpv4(normalized.replace(/^::ffff:/, ""));
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
};

const publicHttpsUrl = (value: unknown): URL | undefined => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return undefined;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateAddress(hostname)) return undefined;
    return url;
  } catch {
    return undefined;
  }
};

const textFromHtml = (html: string): string => html
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<(script|style|nav|header|footer|aside|form|noscript|iframe|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();

const readBoundedBody = async (response: Response): Promise<string> => {
  const advertisedLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_BYTES) throw new Error("too-large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("too-large"); }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(combined);
};

const assertPublicDns = async (url: URL): Promise<void> => {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("invalid");
};

export async function POST(request: Request) {
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
    await Promise.race([assertPublicDns(sourceUrl), deadline]);
    const response = await fetch(sourceUrl, { signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!response.ok) return failure("unavailable");
    const extractedText = textFromHtml(await readBoundedBody(response));
    if (!extractedText) return failure("unavailable");
    const canonicalUrl = new URL(response.url || sourceUrl.toString()).toString();
    return NextResponse.json({
      canonicalUrl,
      extractedText,
      contentHash: `sha256:${createHash("sha256").update(extractedText).digest("hex")}`,
    });
  } catch (error) {
    return failure(error instanceof Error && error.message === "too-large" ? "too-large" : error instanceof Error && error.message === "invalid" ? "invalid" : "unavailable");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
