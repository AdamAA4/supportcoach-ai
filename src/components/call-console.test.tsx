import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CallConsole } from "./call-console";
import { AudioPlayer } from "../voice/audio-player";
import type { VoiceAgent, VoiceAgentEvent } from "../voice/voice-agent";

const context = { source: { kind: "pasted-text" as const, text: "Q: Delivery\nA: Delivery takes 3 to 5 days.", confirmation: "confirmed" as const }, sourceLabel: "Northstar Shop", sourceContentHash: "local:abc", sourceProvenance: { contentHash: "local:abc" }, sourceText: "Q: Delivery\nA: Delivery takes 3 to 5 days.", facts: [{ id: "delivery", question: "Delivery", answer: "Delivery takes 3 to 5 days.", keywords: ["delivery"], source: "faq" as const }], notes: [], scenario: { id: "late-delivery", title: "Late delivery", customerPersona: "Concerned customer", openingLine: "Where is my order?", goals: [], factIds: ["delivery"], difficulty: "beginner" as const } };

class TestVoiceAgent implements VoiceAgent {
  protected onEvent?: (event: VoiceAgentEvent) => void;
  startMicrophone = vi.fn(async () => {});
  setMuted = vi.fn(async () => {});
  end = vi.fn(async () => {});
  async connect(input: { onEvent: (event: VoiceAgentEvent) => void }) { this.onEvent = input.onEvent; input.onEvent({ type: "session-ready", sessionId: "test" }); input.onEvent({ type: "customer-turn-started" }); }
  sendTypedTraineeTurn(): void {}
  interruptCustomer = vi.fn(() => this.onEvent?.({ type: "interrupted" }));
}
class PermissionDeniedAgent extends TestVoiceAgent { constructor() { super(); this.startMicrophone = vi.fn(async () => { this.onEvent?.({ type: "error", code: "permission-denied", message: "Denied" }); }); } }

describe("CallConsole voice-only practice", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("starts voice capture from Join and never renders text practice", async () => {
    const agent = new TestVoiceAgent(); vi.spyOn(AudioPlayer.prototype, "prepare").mockResolvedValue();
    render(<CallConsole context={context} createAgent={() => agent} />);
    expect(screen.getByRole("button", { name: "Join voice call" })).toBeVisible(); expect(screen.queryByLabelText(/typed response/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Join voice call" }));
    await waitFor(() => expect(agent.startMicrophone).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Microphone: On — speak naturally")).toBeVisible(); expect(screen.queryByRole("button", { name: /start microphone/i })).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Mute" })).toBeVisible();
  });
  it("shows a retry state when browser microphone permission is denied", async () => {
    const agent = new PermissionDeniedAgent(); vi.spyOn(AudioPlayer.prototype, "prepare").mockResolvedValue(); render(<CallConsole context={context} createAgent={() => agent} />);
    fireEvent.click(screen.getByRole("button", { name: "Join voice call" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Microphone permission is required"); expect(screen.getByRole("button", { name: "Retry voice call" })).toBeVisible(); expect(screen.queryByLabelText(/typed response/i)).not.toBeInTheDocument();
  });
  it("keeps mute and unmute as the active capture controls", async () => {
    const agent = new TestVoiceAgent(); vi.spyOn(AudioPlayer.prototype, "prepare").mockResolvedValue(); render(<CallConsole context={context} createAgent={() => agent} />);
    fireEvent.click(screen.getByRole("button", { name: "Join voice call" })); await screen.findByRole("button", { name: "Mute" }); fireEvent.click(screen.getByRole("button", { name: "Mute" })); await waitFor(() => expect(agent.setMuted).toHaveBeenCalledWith(true)); fireEvent.click(screen.getByRole("button", { name: "Unmute" })); await waitFor(() => expect(agent.setMuted).toHaveBeenLastCalledWith(false));
  });
});
