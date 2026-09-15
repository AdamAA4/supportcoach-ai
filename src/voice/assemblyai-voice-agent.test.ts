import { describe, expect, it, vi } from "vitest";
import React from "react";

import { GET as getVoiceToken } from "../app/api/voice-token/route";
import { POST as importReference } from "../app/api/reference-import/route";
import { GET as getHealth } from "../app/api/health/route";
import type { ScenarioDefinition } from "../domain/practice-pack";
import { AudioPlayer } from "./audio-player";
import { AssemblyAiVoiceAgent, createConfiguredVoiceAgent } from "./assemblyai-voice-agent";
import type { VoiceSocketConstructor } from "./assemblyai-voice-agent";
import { MockVoiceAgent } from "./mock-voice-agent";
import { CallConsole } from "../components/call-console";
import { SourceSetupForm } from "../components/source-setup-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { VoiceAgentEvent } from "./voice-agent";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const scenario: ScenarioDefinition = {
  id: "late-delivery",
  title: "Late delivery",
  customerPersona: "A customer worried that their order is late.",
  openingLine: "My order was due already. Where is it?",
  goals: ["Ask for a delivery update"],
  factIds: ["delivery"],
  difficulty: "beginner",
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;
  readonly sent: string[] = [];
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) { FakeWebSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.({ code: 1000 } as CloseEvent); }
  open() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(new Event("open")); }
  receive(message: Record<string, unknown>) { this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent); }
}

describe("voice-token route", () => {
  it("returns a stable 503 when the permanent key is absent", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);

    const response = await getVoiceToken();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "voice_unconfigured", message: "Voice service is not configured." } });
    expect(request).not.toHaveBeenCalled();
  });

  it("sends the permanent key only to AssemblyAI and returns only the temporary token", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "permanent-secret");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "temporary-token" }), { status: 200 }));
    vi.stubGlobal("fetch", request);

    const response = await getVoiceToken();

    expect(request).toHaveBeenCalledWith(
      "https://agents.assemblyai.com/v1/token?expires_in_seconds=300",
      expect.objectContaining({ headers: { Authorization: "Bearer permanent-secret" } }),
    );
    const payload = await response.json();
    expect(payload).toEqual({ token: "temporary-token" });
    expect(JSON.stringify(payload)).not.toContain("permanent-secret");
  });

  it("normalizes an upstream token failure without returning upstream details", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "permanent-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider detail", { status: 401 })));

    const response = await getVoiceToken();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: { code: "voice_unavailable", message: "Voice service is temporarily unavailable." } });
  });
});

describe("reference importer", () => {
  it("rejects a private-network target before fetching and does not log source content", async () => {
    const request = vi.fn();
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", request);

    const response = await importReference(new Request("http://localhost/api/reference-import", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://127.0.0.1/faq" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "invalid_reference_url", message: "Enter a public HTTPS URL." } });
    expect(request).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("returns a sanitized canonical snapshot and hash from one bounded public fetch", async () => {
    const request = vi.fn().mockResolvedValue(new Response("<nav>ignore</nav><main><h1>Refunds</h1><p>Refunds are available within 30 days.</p><script>secret()</script></main>", { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", request);

    const response = await importReference(new Request("http://localhost/api/reference-import", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com/policy" }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ canonicalUrl: "https://example.com/policy", extractedText: "Refunds Refunds are available within 30 days." });
    expect(payload.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(payload.extractedText).not.toContain("ignore");
    expect(payload.extractedText).not.toContain("secret");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("uses stable 413 and 502 envelopes for large and unavailable public sources", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200, headers: { "content-length": "204801" } })));
    const large = await importReference(new Request("http://localhost/api/reference-import", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com/large" }),
    }));
    expect(large.status).toBe(413);
    await expect(large.json()).resolves.toEqual({ error: { code: "reference_too_large", message: "The reference source must be 200 KB or smaller." } });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));
    const unavailable = await importReference(new Request("http://localhost/api/reference-import", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com/missing" }),
    }));
    expect(unavailable.status).toBe(502);
    await expect(unavailable.json()).resolves.toEqual({ error: { code: "reference_unavailable", message: "The reference source could not be imported." } });
  });
});

describe("health route", () => {
  it("returns a non-secret readiness response", async () => {
    const response = getHealth();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("source setup import", () => {
  it("imports a public source once during setup and retains the server hash for confirmation", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      canonicalUrl: "https://example.com/faq",
      extractedText: "Refunds are available within 30 days.",
      contentHash: "sha256:source-hash",
    }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    render(React.createElement(SourceSetupForm));

    fireEvent.click(screen.getByLabelText("Public HTTPS link"));
    fireEvent.change(screen.getByLabelText("FAQ or policy URL"), { target: { value: "https://example.com/faq" } });
    fireEvent.click(screen.getByRole("button", { name: "Import source" }));

    expect(await screen.findByText("Refunds are available within 30 days.")).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/api/reference-import", expect.objectContaining({ method: "POST" }));
  });
});

describe("AssemblyAI voice agent", () => {
  it("selects the live adapter only when the public mode is live", () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODE", "mock");
    expect(createConfiguredVoiceAgent()).toBeInstanceOf(MockVoiceAgent);
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODE", "live");
    expect(createConfiguredVoiceAgent()).toBeInstanceOf(AssemblyAiVoiceAgent);
  });

  it("fetches a temporary token and sends the scenario, persona, facts, and responder rules in its prompt", async () => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "temporary-token" }), { status: 200 })));
    const agent = new AssemblyAiVoiceAgent({ WebSocket: FakeWebSocket as unknown as VoiceSocketConstructor });

    const connecting = agent.connect({ scenario, facts: [{ id: "delivery", question: "When?", answer: "Three to five days.", keywords: [], source: "faq" }], onEvent: () => {} });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toContain("token=temporary-token");
    socket.open();
    await connecting;

    const update = JSON.parse(socket.sent[0]);
    expect(update.type).toBe("session.update");
    expect(update.session.system_prompt).toContain(scenario.title);
    expect(update.session.system_prompt).toContain(scenario.customerPersona);
    expect(update.session.system_prompt).toContain("Three to five days.");
    expect(update.session.system_prompt).toContain("trainee is the support responder");
    expect(update.session.system_prompt).toContain("never a real customer support assistant");
  });

  it("forwards mocked WebSocket customer audio to AudioPlayer and flushes playback on an interruption", async () => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "temporary-token" }), { status: 200 })));
    const live = new AssemblyAiVoiceAgent({ WebSocket: FakeWebSocket as unknown as VoiceSocketConstructor });
    const play = vi.spyOn(AudioPlayer.prototype, "play").mockResolvedValue(undefined);
    const stop = vi.spyOn(AudioPlayer.prototype, "stop").mockImplementation(() => undefined);
    const context = { source: { kind: "pasted-text" as const, text: "FAQ", confirmation: "confirmed" as const }, sourceLabel: "Northstar", sourceContentHash: "local:test", sourceProvenance: { contentHash: "local:test" }, sourceText: "FAQ", facts: [], notes: [], scenario };
    render(React.createElement(CallConsole, { context, createAgent: () => live }));
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive({ type: "session.ready", session_id: "call-1" });
    await screen.findByText("Call status:");

    socket.receive({ type: "reply.started" });
    socket.receive({ type: "reply.audio", data: "AA==" });
    await waitFor(() => expect(play).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.any(Function)));
    socket.receive({ type: "input.speech.started" });
    expect(stop).toHaveBeenCalled();
    play.mockRestore();
    stop.mockRestore();
  });

  it("closes the socket and microphone tracks exactly once across repeated fatal cleanup", async () => {
    FakeWebSocket.instances = [];
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "temporary-token" }), { status: 200 })));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    class FakeAudioContext {
      state: AudioContextState = "running";
      destination = {} as AudioDestinationNode;
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() }) as unknown as MediaStreamAudioSourceNode;
      createScriptProcessor = () => ({ connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null }) as unknown as ScriptProcessorNode;
      createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } }) as unknown as GainNode;
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => { this.state = "closed"; });
    }
    const agent = new AssemblyAiVoiceAgent({ WebSocket: FakeWebSocket as unknown as VoiceSocketConstructor, AudioContext: FakeAudioContext as unknown as typeof AudioContext });
    const events: VoiceAgentEvent[] = [];
    const connecting = agent.connect({ scenario, facts: [], onEvent: (event) => events.push(event) });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0]; socket.open(); await connecting;
    socket.receive({ type: "session.ready", session_id: "call-1" });
    await agent.startMicrophone();
    socket.receive({ type: "session.error", code: "invalid_format" });
    await agent.end();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "error", code: "protocol" })]));
  });
});
