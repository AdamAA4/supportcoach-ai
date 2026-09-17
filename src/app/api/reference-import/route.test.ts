// @vitest-environment node
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { checkServerIdentity } from "node:tls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));
vi.mock("node:tls", () => ({ checkServerIdentity: vi.fn() }));

const importUrl = (url = "https://example.com/policy") => POST(new Request("http://localhost/api/reference-import", { method: "POST", body: JSON.stringify({ url }) }));
const respond = (body: string | Buffer[], statusCode = 200, headers = {}) => {
  const response = Readable.from(Array.isArray(body) ? body : [Buffer.from(body)]);
  Object.assign(response, { statusCode, headers });
  vi.mocked(httpsRequest).mockImplementation(((_options: RequestOptions, callback: (response: unknown) => void) => {
    const request = new EventEmitter();
    return Object.assign(request, { end: () => callback(response), destroy: vi.fn(() => request.emit("error", new Error("aborted"))) });
  }) as unknown as typeof httpsRequest);
  return response;
};

beforeEach(() => {
  vi.mocked(lookup).mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  vi.mocked(httpsRequest).mockReset();
  respond("<nav>ignore</nav><main><h1>Refunds</h1><p>Within 30 days.</p><script>secret()</script></main>");
  // Prevent the old implementation from making a real request in RED runs.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("old fetch")));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("public HTTPS import boundary", () => {
  it("returns the stable invalid envelope without retrieval or source logging", async () => {
    const info = vi.spyOn(console, "info");
    const response = await importUrl("https://127.0.0.1/faq");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_reference_url", message: "Enter a public HTTPS URL." } });
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
  it.each([
    "::ffff:7f00:1", "::ffff:127.0.0.1", "0:0:0:0:0:ffff:7f00:1", "::ffff:a00:1",
    "fe90::1", "febf::1", "fec0::1", "ff02::1", "::", "::1", "fc00::1", "fd00::1",
    "2001:db8::1", "2001::1", "2002:7f00:1::", "64:ff9b::7f00:1", "3fff::1",
    "192.0.2.1", "198.51.100.1", "203.0.113.1", "100.64.0.1", "198.19.0.1", "not-an-address",
  ])("rejects nonpublic DNS answer %s before retrieval", async (address) => {
    vi.mocked(lookup).mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }] as never);
    expect((await importUrl()).status).toBe(400);
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["https://[::ffff:7f00:1]/", "https://[fe90::1]/", "https://127.1/", "https://2130706433/", "https://localhost./"])("rejects private literal %s without DNS", async (url) => {
    expect((await importUrl(url)).status).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("pins HTTPS to the validated numeric address even if DNS changes afterward", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never)
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    const response = await importUrl();
    expect(response.status).toBe(200);
    expect(httpsRequest).toHaveBeenCalledTimes(1);
    const options = vi.mocked(httpsRequest).mock.calls[0][0] as RequestOptions;
    expect(options.hostname).toBe("93.184.216.34");
    expect(isIP(options.hostname!)).toBe(4);
    expect(options).toMatchObject({ servername: "example.com", headers: { Host: "example.com" }, rejectUnauthorized: true, agent: false });
    options.checkServerIdentity!("93.184.216.34", {} as never);
    expect(checkServerIdentity).toHaveBeenCalledWith("example.com", {});
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ canonicalUrl: "https://example.com/policy", extractedText: "Refunds\nWithin 30 days.", contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/) });
  });

  it("accepts public IPv6 without a DNS lookup", async () => {
    expect((await importUrl("https://[2606:4700:4700::1111]/")).status).toBe(200);
    expect(lookup).not.toHaveBeenCalled();
    expect(httpsRequest).toHaveBeenCalledWith(expect.objectContaining({ hostname: "2606:4700:4700::1111" }), expect.any(Function));
  });

  it("rejects a mixed public/private DNS answer", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "::ffff:7f00:1", family: 6 }] as never);
    expect((await importUrl()).status).toBe(400);
  });

  it("refuses redirects without making another request", async () => {
    const upstream = respond("redirect", 302, { location: "https://127.0.0.1/" });
    expect((await importUrl()).status).toBe(502);
    expect(httpsRequest).toHaveBeenCalledTimes(1);
    expect(upstream.destroyed).toBe(true);
  });

  it.each([true, false])("enforces advertised and streamed size limits (advertised: %s)", async (advertised) => {
    const upstream = respond([Buffer.alloc(2 * 1024 * 1024), Buffer.alloc(1)], 200, advertised ? { "content-length": String(2 * 1024 * 1024 + 1) } : {});
    const response = await importUrl();
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "reference_too_large" } });
    expect(upstream.destroyed).toBe(true);
  });

  it("times out DNS without starting a late connection", async () => {
    vi.useFakeTimers();
    let resolve!: (addresses: unknown) => void;
    vi.mocked(lookup).mockReturnValue(new Promise((done) => { resolve = done; }) as never);
    const pending = importUrl();
    await vi.advanceTimersByTimeAsync(5001);
    expect((await pending).status).toBe(502);
    resolve([{ address: "93.184.216.34", family: 4 }]);
    await Promise.resolve();
    expect(httpsRequest).not.toHaveBeenCalled();
  });

  it("times out an unfinished HTTPS response and aborts the connection", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.mocked(httpsRequest).mockImplementation(((options: RequestOptions) => {
      signal = options.signal;
      return Object.assign(new EventEmitter(), { end: vi.fn() });
    }) as unknown as typeof httpsRequest);
    const pending = importUrl();
    await vi.advanceTimersByTimeAsync(5001);
    const response = await pending;
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "reference_unavailable", message: "The reference source could not be imported." } });
    expect(signal?.aborted).toBe(true);
  });
});
