import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CallConsole } from "./call-console";
import { AudioPlayer } from "../voice/audio-player";
import type { VoiceAgent, VoiceAgentEvent } from "../voice/voice-agent";

const context = {
  source: { kind: "pasted-text" as const, text: "Q: Delivery\nA: Delivery takes 3 to 5 days.", confirmation: "confirmed" as const },
  sourceLabel: "Northstar Shop",
  sourceContentHash: "local:abc",
  sourceProvenance: { contentHash: "local:abc" },
  sourceText: "Q: Delivery\nA: Delivery takes 3 to 5 days.",
  facts: [{ id: "delivery", question: "Delivery", answer: "Delivery takes 3 to 5 days.", keywords: ["delivery"], source: "faq" as const }],
  notes: [{ id: "note", text: "Pause before answering.", format: "plain-text" as const, kind: "personal-coaching-note" as const }],
  scenario: { id: "late-delivery", title: "Late delivery", customerPersona: "Concerned customer", openingLine: "Where is my order?", goals: [], factIds: ["delivery"], difficulty: "beginner" as const },
};

class ErrorVoiceAgent implements VoiceAgent {
  private onEvent?: (event: VoiceAgentEvent) => void;
  async connect(input: { onEvent: (event: VoiceAgentEvent) => void }) { this.onEvent = input.onEvent; this.onEvent({ type: "error", code: "network", message: "Connection lost." }); }
  async startMicrophone() {}
  sendTypedTraineeTurn() {}
  interruptCustomer() {}
  async end() {}
}

class PermissionDeniedVoiceAgent implements VoiceAgent {
  private onEvent?: (event: VoiceAgentEvent) => void;
  async connect(input: { onEvent: (event: VoiceAgentEvent) => void }) { this.onEvent = input.onEvent; this.onEvent({ type: "session-ready", sessionId: "test" }); }
  async startMicrophone() { this.onEvent?.({ type: "error", code: "permission-denied", message: "Microphone access was denied." }); }
  sendTypedTraineeTurn() {}
  interruptCustomer() {}
  async end() {}
}

class InteractiveVoiceAgent implements VoiceAgent {
  private onEvent?: (event: VoiceAgentEvent) => void;
  setMuted = vi.fn(async () => {});
  async connect(input: { onEvent: (event: VoiceAgentEvent) => void }) {
    this.onEvent = input.onEvent;
    this.onEvent({ type: "session-ready", sessionId: "test" });
    this.onEvent({ type: "customer-turn-started" });
  }
  async startMicrophone() {}
  sendTypedTraineeTurn(text: string) { this.interruptCustomer(); this.onEvent?.({ type: "trainee-transcript", text, final: true }); this.onEvent?.({ type: "customer-turn-started" }); }
  interruptCustomer = vi.fn(() => { this.onEvent?.({ type: "interrupted" }); });
  async end() {}
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

class StartupVoiceAgent implements VoiceAgent {
  private onEvent?: (event: VoiceAgentEvent) => void;
  connect = vi.fn(async (input: { onEvent: (event: VoiceAgentEvent) => void }) => {
    this.onEvent = input.onEvent;
    await this.startup;
  });
  end = vi.fn(async () => {});

  constructor(private readonly startup: Promise<void> = Promise.resolve()) {}
  emit(event: VoiceAgentEvent) { this.onEvent?.(event); }
  async startMicrophone() {}
  sendTypedTraineeTurn() {}
  interruptCustomer() {}
}

describe("CallConsole", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("keeps a single owned agent through React StrictMode effect replay", async () => {
    const agents: StartupVoiceAgent[] = [];
    const view = render(
      <React.StrictMode>
        <CallConsole context={context} createAgent={() => {
          const created = new StartupVoiceAgent();
          agents.push(created);
          return created;
        }} />
      </React.StrictMode>,
    );

    await waitFor(() => expect(agents.some((created) => created.connect.mock.calls.length === 1)).toBe(true));
    const ownershipBeforeUnmount = agents.map((created) => ({ connected: created.connect.mock.calls.length, ended: created.end.mock.calls.length }));
    view.unmount();

    expect(ownershipBeforeUnmount.filter(({ connected, ended }) => connected === 1 && ended === 0)).toHaveLength(1);
    expect(ownershipBeforeUnmount.filter(({ ended }) => ended === 0)).toHaveLength(1);
    expect(agents.every((created) => created.end.mock.calls.length === 1)).toBe(true);
  });

  it("ends an agent and ignores its events when unmounted during startup", async () => {
    const startup = deferred();
    const created = new StartupVoiceAgent(startup.promise);
    const stop = vi.spyOn(AudioPlayer.prototype, "stop");
    const view = render(<CallConsole context={context} createAgent={() => created} />);
    await waitFor(() => expect(created.connect).toHaveBeenCalledTimes(1));

    view.unmount();
    expect(created.end).toHaveBeenCalledTimes(1);
    const stopsAfterUnmount = stop.mock.calls.length;

    await act(async () => {
      created.emit({ type: "error", code: "network", message: "Late startup failure." });
      startup.resolve();
      await startup.promise;
    });

    expect(stop).toHaveBeenCalledTimes(stopsAfterUnmount);
  });
  it("renders an error with retry while keeping reference material available", async () => {
    render(<CallConsole context={context} createAgent={() => new ErrorVoiceAgent()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost.");
    expect(screen.getByRole("button", { name: "Retry call" })).toBeEnabled();
    expect(screen.getByText("Delivery takes 3 to 5 days.")).toBeVisible();
    expect(screen.getByText("Pause before answering.")).toBeVisible();
  });

  it("submits typed fallback only after the trainee chooses to send it", async () => {
    render(<CallConsole context={context} />);
    const input = await screen.findByLabelText("Typed response");
    fireEvent.change(input, { target: { value: "I will check the tracking link." } });
    expect(screen.queryByText("I will check the tracking link.", { selector: "p" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send typed response" }));
    await waitFor(() => expect(screen.getByText("I will check the tracking link.", { selector: "p" })).toBeVisible());
  });

  it("keeps typed fallback usable after microphone permission is denied", async () => {
    render(<CallConsole context={context} createAgent={() => new PermissionDeniedVoiceAgent()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start microphone" }));

    expect(await screen.findByText("Microphone access was denied. Typed fallback is active.")).toBeVisible();
    const input = screen.getByLabelText("Typed response");
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: "I will check that now." } });
    expect(screen.getByRole("button", { name: "Send typed response" })).toBeEnabled();
  });

  it("shows the normal typed turn sequence and keeps the session reference available during an active call", async () => {
    render(<CallConsole context={context} createAgent={() => new InteractiveVoiceAgent()} />);
    const input = await screen.findByLabelText("Typed response");

    expect(screen.getByText("customer speaking")).toBeVisible();
    expect(screen.getByText("Delivery takes 3 to 5 days.")).toBeVisible();
    fireEvent.change(input, { target: { value: "I will review the delivery status." } });
    fireEvent.click(screen.getByRole("button", { name: "Send typed response" }));

    expect(await screen.findByText("I will review the delivery status.", { selector: "p" })).toBeVisible();
    expect(screen.getByText("customer speaking")).toBeVisible();
  });

  it("flushes customer audio and pauses then resumes microphone capture when muted", async () => {
    const interactive = new InteractiveVoiceAgent();
    render(<CallConsole context={context} createAgent={() => interactive} />);

    expect(await screen.findByText("Customer audio: Speaking")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(interactive.interruptCustomer).toHaveBeenCalled();
    expect(interactive.setMuted).toHaveBeenCalledWith(true);
    expect(screen.getByText("Customer audio: Idle")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(interactive.setMuted).toHaveBeenLastCalledWith(false));
  });
});
