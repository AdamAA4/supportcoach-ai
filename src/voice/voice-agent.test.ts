import { describe, expect, it, vi } from "vitest";

import { MockVoiceAgent, mockCustomerAudioFixture, mockCustomerFollowUpAudioFixture } from "./mock-voice-agent";
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
    state = reduceCallState(state, { type: "session-ready" });
    state = reduceCallState(state, { type: "customer-turn-started" });
    state = reduceCallState(state, { type: "customer-turn-ended" });
    state = reduceCallState(state, { type: "trainee-turn-finalized" });
    state = reduceCallState(state, { type: "customer-turn-started" });

    expect(state).toBe("customer-speaking");
  });

  it("consumes session readiness and rejects invalid jumps", () => {
    expect(reduceCallState("connecting", { type: "customer-turn-started" })).toBe("connecting");
    expect(reduceCallState("idle", { type: "session-ready" })).toBe("idle");
    expect(reduceCallState("connecting", { type: "session-ready" })).toBe("listening");
    expect(reduceCallState("listening", { type: "customer-turn-ended" })).toBe("listening");
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

  it("uses a bundled spoken customer audio fixture instead of synthesizing a tone", () => {
    expect(mockCustomerAudioFixture).toBe("/voice/mock-customer-opening.wav");
    expect(mockCustomerFollowUpAudioFixture).toBe("/voice/mock-customer-follow-up.wav");
  });

  it("stops recognition while muted and resumes it when unmuted", async () => {
    const stop = vi.fn();
    const start = vi.fn();
    class Recognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onstart = null;
      onresult = null;
      onerror = null;
      onend = null;
      start = start;
      stop = stop;
    }
    vi.stubGlobal("SpeechRecognition", Recognition);
    const agent = new MockVoiceAgent();

    await agent.startMicrophone();
    await agent.setMuted(true);
    await agent.setMuted(false);

    expect(stop).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
