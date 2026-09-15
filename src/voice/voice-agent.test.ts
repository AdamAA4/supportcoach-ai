import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { ScenarioDefinition } from "../domain/practice-pack";
import type { ReferenceFact } from "../domain/reference-source";
import { MockVoiceAgent } from "./mock-voice-agent";
import { reduceCallState, type VoiceAgent, type VoiceAgentEvent } from "./voice-agent";

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
  it("preserves the mandated public voice-agent contract", () => {
    type ExpectedVoiceAgent = {
      connect(input: { scenario: ScenarioDefinition; facts: ReferenceFact[]; onEvent: (event: VoiceAgentEvent) => void }): Promise<void>;
      startMicrophone(): Promise<void>;
      sendTypedTraineeTurn(text: string): void;
      interruptCustomer(): void;
      end(): Promise<void>;
    };

    expectTypeOf<VoiceAgent>().toEqualTypeOf<ExpectedVoiceAgent>();
  });

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

  it("keeps the customer-audio event to its mandated audio-only shape", () => {
    const event: VoiceAgentEvent = { type: "customer-audio", audio: new ArrayBuffer(0) };
    expect(event).toEqual({ type: "customer-audio", audio: expect.any(ArrayBuffer) });
  });

  it("speaks the actual dynamic opening and follow-up when browser synthesis is available", async () => {
    vi.useFakeTimers();
    const speak = vi.fn();
    const cancel = vi.fn();
    class Utterance { constructor(public text: string) {} }
    vi.stubGlobal("speechSynthesis", { speak, cancel });
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    const agent = new MockVoiceAgent();

    await agent.connect({ scenario, facts: [], onEvent: () => {} });
    agent.sendTypedTraineeTurn("I will check that for you.");
    await vi.runAllTimersAsync();

    expect(speak.mock.calls.map(([utterance]) => utterance.text)).toEqual([
      scenario.openingLine,
      "Thanks. What is the next step you can offer me?",
    ]);
    agent.interruptCustomer();
    expect(cancel).toHaveBeenCalled();
    await agent.end();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("emits bundled fixture audio only when browser synthesis is unavailable", async () => {
    const fetch = vi.fn(async () => new Response(new ArrayBuffer(4), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const events: VoiceAgentEvent[] = [];
    const agent = new MockVoiceAgent();

    await agent.connect({ scenario, facts: [], onEvent: (event) => events.push(event) });
    await vi.waitFor(() => expect(events.some((event) => event.type === "customer-audio")).toBe(true));

    expect(fetch).toHaveBeenCalledWith("/voice/mock-customer-opening.wav");
    expect(events.filter((event) => event.type === "customer-audio")).toEqual([
      { type: "customer-audio", audio: expect.any(ArrayBuffer) },
    ]);
    await agent.end();
    vi.unstubAllGlobals();
  });

  it("suppresses a pending fixture after customer interruption", async () => {
    let resolveFixture: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFixture = resolve; })));
    const events: VoiceAgentEvent[] = [];
    const agent = new MockVoiceAgent();

    await agent.connect({ scenario, facts: [], onEvent: (event) => events.push(event) });
    agent.interruptCustomer();
    resolveFixture?.(new Response(new ArrayBuffer(4), { status: 200 }));
    await Promise.resolve();

    expect(events.filter((event) => event.type === "customer-audio")).toEqual([]);
    await agent.end();
    vi.unstubAllGlobals();
  });
});
