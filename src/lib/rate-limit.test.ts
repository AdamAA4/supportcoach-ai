import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows requests up to the window maximum and blocks after it", () => {
    const time = () => 0;
    const limit = createRateLimiter(60_000, 3, time);
    expect(limit("ip-1").allowed).toBe(true);
    expect(limit("ip-1").allowed).toBe(true);
    expect(limit("ip-1").allowed).toBe(true);
    const blocked = limit("ip-1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const time = () => 0;
    const limit = createRateLimiter(60_000, 1, time);
    expect(limit("a").allowed).toBe(true);
    expect(limit("b").allowed).toBe(true);
    expect(limit("a").allowed).toBe(false);
  });

  it("opens a fresh window after it elapses and reports the remaining wait", () => {
    let time = 0;
    const limit = createRateLimiter(60_000, 1, () => time);
    expect(limit("ip").allowed).toBe(true);
    expect(limit("ip").allowed).toBe(false);
    time = 30_000;
    const waiting = limit("ip");
    expect(waiting.allowed).toBe(false);
    expect(waiting.retryAfterSeconds).toBe(30);
    time = 60_001;
    expect(limit("ip").allowed).toBe(true);
  });
});
