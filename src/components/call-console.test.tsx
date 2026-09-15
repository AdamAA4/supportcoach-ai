import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CallConsole } from "./call-console";
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

describe("CallConsole", () => {
  afterEach(cleanup);
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
});
