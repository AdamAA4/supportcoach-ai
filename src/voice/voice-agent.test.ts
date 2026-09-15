import { describe, expect, it, vi } from "vitest";

import { MockVoiceAgent, createMockCustomerAudio } from "./mock-voice-agent";
import { reduceCallState } from "./voice-agent";

const scenario = {
  id: "late-delivery",
  title: "Late delivery",
  customerPersona: "A concerned customer.",
  openingLine: "My order was meant to arrive already. Where is it?",
  goals: [],
  factIds: [],
  difficulty: "beginner" as const,
};

describe("call state machine", () => {
  it("moves through a normal practice turn", () => {
    let state = reduceCallState("idle", { type: "connect" });
    state = reduceCallState(state, { type: "customer-turn-started" });
    state = reduceCallState(state, { type: "customer-turn-ended" });
    state = reduceCallState(state, { type: "trainee-turn-finalized" });
    state = reduceCallState(state, { type: "customer-turn-started" });

    expect(state).toBe("customer-speaking");
  });

  it("returns to listening after an interruption", () => {
    expect(reduceCallState("customer-speaking", { type: "interrupted" })).toBe("listening");
  });

  it("moves errors to a terminal state until retry", () => {
    expect(reduceCallState("listening", { type: "error" })).toBe("error");
    expect(reduceCallState("error", { type: "customer-turn-ended" })).toBe("error");
    expect(reduceCallState("error", { type: "retry" })).toBe("connecting");
  });
});

describe("mock voice agent", () => {
  it("emits a typed trainee transcript followed by a deterministic customer response", async () => {
    vi.useFakeTimers();
    const events: Array<{ type: string; text?: string; final?: boolean }> = [];
    const agent = new MockVoiceAgent();

    await agent.connect({ scenario, facts: [], onEvent: (event) => events.push(event) });
    agent.sendTypedTraineeTurn("I can check that for you.");
    await vi.runAllTimersAsync();

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "session-ready" }),
      expect.objectContaining({ type: "trainee-transcript", text: "I can check that for you.", final: true }),
      expect.objectContaining({ type: "customer-transcript", final: true }),
    ]));
    await agent.end();
    vi.useRealTimers();
  });

  it("interrupts customer audio before accepting a typed fallback", async () => {
    const events: Array<{ type: string }> = [];
    const agent = new MockVoiceAgent();
    await agent.connect({ scenario, facts: [], onEvent: (event) => events.push(event) });

    agent.interruptCustomer();
    agent.sendTypedTraineeTurn("Please check the tracking number.");

    expect(events.map((event) => event.type)).toContain("interrupted");
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "trainee-transcript", final: true }),
    ]));
    await agent.end();
  });

  it("creates a browser-playable WAV fixture for customer audio", () => {
    const audio = createMockCustomerAudio();
    expect(new TextDecoder().decode(audio.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(audio.slice(8, 12))).toBe("WAVE");
  });
});
