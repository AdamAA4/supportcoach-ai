import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssemblyAiVoiceAgent } from "./assemblyai-voice-agent";
import { AudioPlayer } from "./audio-player";
import { CallConsole } from "../components/call-console";
import type { VoiceAgentEvent } from "./voice-agent";

const scenario = { id: "late-delivery", title: "Late delivery", customerPersona: "Concerned customer", openingLine: "Where is my order?", goals: [], factIds: [], difficulty: "beginner" as const };
const context = { source: { kind: "pasted-text" as const, text: "FAQ", confirmation: "confirmed" as const }, sourceLabel: "Northstar", sourceContentHash: "local:test", sourceProvenance: { contentHash: "local:test" }, sourceText: "FAQ", facts: [], notes: [], scenario };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
class Socket {
  static instances: Socket[] = [];
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.({ code: 1000 } as CloseEvent); });
  constructor() { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(new Event("open")); }
  receive(message: object) { this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent); }
}
class CaptureContext {
  static instances: CaptureContext[] = [];
  state = "running";
  sampleRate = 48_000;
  destination = {};
  processor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null };
  source = { connect: vi.fn(), disconnect: vi.fn() };
  gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  createMediaStreamSource = () => this.source;
  createScriptProcessor = () => this.processor;
  createGain = () => this.gain;
  resume = vi.fn(async () => {});
  close = vi.fn(async () => { this.state = "closed"; });
  constructor() { CaptureContext.instances.push(this); }
  frame(samples = new Float32Array([0.2, -0.1])) { this.processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => samples } } as unknown as AudioProcessingEvent); }
}
const track = { enabled: true, stop: vi.fn() };
const stream = { getTracks: () => [track] } as unknown as MediaStream;
const token = () => new Response(JSON.stringify({ token: "temporary" }));
const getUserMedia = vi.fn();
const makeAgent = (request = vi.fn().mockImplementation(async () => token())) => new AssemblyAiVoiceAgent({ fetch: request, WebSocket: Socket, AudioContext: CaptureContext as unknown as typeof AudioContext, mediaDevices: { getUserMedia } as unknown as MediaDevices });
const ready = async (agent: AssemblyAiVoiceAgent, events: VoiceAgentEvent[] = []) => {
  const pending = agent.connect({ scenario, facts: [], onEvent: (event) => events.push(event) });
  await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
  const socket = Socket.instances[0];
  socket.open();
  await pending;
  socket.receive({ type: "session.ready", session_id: "call-1" });
  return socket;
};
beforeEach(() => { Socket.instances = []; CaptureContext.instances = []; track.enabled = true; track.stop.mockClear(); getUserMedia.mockReset().mockResolvedValue(stream); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("live lifecycle and capture", () => {
  it("configures continuous trainee partials without changing the audio formats", async () => {
    const agent = makeAgent();
    const socket = await ready(agent);
    const update = JSON.parse(socket.send.mock.calls[0][0] as string);

    expect(update.session.input).toEqual({
      format: { encoding: "audio/pcm" },
      continuous_partials: true,
      turn_detection: { vad_threshold: 0.3, interrupt_response: true },
    });
    expect(update.session.output).toEqual({ voice: "alba", format: { encoding: "audio/pcm" }, volume: 100 });
    await agent.end();
  });

  it("emits one microphone signal after the first non-silent captured frame", async () => {
    const events: VoiceAgentEvent[] = [];
    const agent = makeAgent();
    await ready(agent, events);
    await agent.startMicrophone();
    const graph = CaptureContext.instances[0];

    graph.frame(new Float32Array([0, 0]));
    expect(events.filter((event) => event.type === "microphone-signal")).toHaveLength(0);
    graph.frame();
    graph.frame();

    expect(events.filter((event) => event.type === "microphone-signal")).toHaveLength(1);
    await agent.end();
  });

  it("reports aggregate capture diagnostics after sending microphone PCM", async () => {
    const events: VoiceAgentEvent[] = [];
    const agent = makeAgent();
    await ready(agent, events);
    await agent.startMicrophone();
    const graph = CaptureContext.instances[0];

    graph.frame(new Float32Array(4_800).fill(0.25));

    expect(events.filter((event) => (event as { type: string }).type === "capture-diagnostics")).toContainEqual(expect.objectContaining({
      inputSampleRate: 48_000,
      audioSecondsSent: 0.1,
      framesSent: 1,
    }));
    await agent.end();
  });

  it("emits trainee speech detection before the existing interruption event", async () => {
    const events: VoiceAgentEvent[] = [];
    const agent = makeAgent();
    const socket = await ready(agent, events);

    socket.receive({ type: "input.speech.started" });

    expect(events.slice(-2).map((event) => event.type)).toEqual(["trainee-speech-started", "interrupted"]);
    await agent.end();
  });

  it("end during token fetch prevents late socket creation", async () => {
    const result = deferred<Response>();
    const request = vi.fn().mockReturnValue(result.promise);
    const agent = makeAgent(request);
    const connecting = agent.connect({ scenario, facts: [], onEvent: vi.fn() });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await agent.end();
    result.resolve(token());
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(Socket.instances).toHaveLength(0);
    await connecting;
  });

  it("end during getUserMedia stops the obsolete stream without creating an audio graph", async () => {
    const result = deferred<MediaStream>();
    getUserMedia.mockReturnValue(result.promise);
    const agent = makeAgent();
    await ready(agent);
    const acquiring = agent.startMicrophone();
    await agent.end();
    result.resolve(stream);
    await acquiring;
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(CaptureContext.instances).toHaveLength(0);
  });

  it("coalesces repeated connect and microphone startup, and releases each resource once", async () => {
    const result = deferred<Response>();
    const request = vi.fn().mockReturnValue(result.promise);
    const agent = makeAgent(request);
    const input = { scenario, facts: [], onEvent: vi.fn() };
    const first = agent.connect(input);
    const second = agent.connect(input);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    expect(request).toHaveBeenCalledTimes(1);
    result.resolve(token());
    await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
    const socket = Socket.instances[0]; socket.open();
    await Promise.all([first, second]);
    await agent.connect(input);
    await Promise.all([agent.startMicrophone(), agent.startMicrophone()]);
    await agent.startMicrophone();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(CaptureContext.instances).toHaveLength(1);
    await Promise.all([agent.end(), agent.end()]);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(CaptureContext.instances[0].close).toHaveBeenCalledTimes(1);
    expect(CaptureContext.instances[0].processor.disconnect).toHaveBeenCalledTimes(1);
  });

  it("mute sends zero frames, disables tracks, and resumes the same graph", async () => {
    const agent = makeAgent();
    const socket = await ready(agent);
    await agent.startMicrophone();
    const graph = CaptureContext.instances[0];
    graph.frame();
    const count = socket.send.mock.calls.length;
    const muteable = agent as unknown as { setMuted: (muted: boolean) => Promise<void> };
    await muteable.setMuted(true);
    graph.frame(); graph.frame();
    expect(track.enabled).toBe(false);
    expect(socket.send).toHaveBeenCalledTimes(count);
    await muteable.setMuted(false);
    graph.frame();
    expect(track.enabled).toBe(true);
    expect(socket.send).toHaveBeenCalledTimes(count + 1);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(CaptureContext.instances).toHaveLength(1);
    await agent.end();
  });

  it("permission denial emits a recoverable voice-only microphone error", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const agent = makeAgent();
    const events: VoiceAgentEvent[] = [];
    const socket = await ready(agent, events);
    await agent.startMicrophone();
    expect(events).toContainEqual(expect.objectContaining({ type: "error", code: "permission-denied" }));
    expect(socket.close).not.toHaveBeenCalled();
    agent.sendTypedTraineeTurn("I will check the delivery.");
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(events).not.toContainEqual(expect.objectContaining({ type: "trainee-transcript" }));
    await agent.end();
  });

  it.each(["clean-close", "session.ended", "socket-error", "session.error"])("remote %s cleans capture and moves the console out of connected state", async (termination) => {
    const agent = makeAgent();
    const stop = vi.spyOn(AudioPlayer.prototype, "stop");
    render(React.createElement(CallConsole, { context, createAgent: () => agent }));
    fireEvent.click(screen.getByRole("button", { name: "Join voice call" }))
    await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
    const socket = Socket.instances[0];
    await act(async () => { socket.open(); socket.receive({ type: "session.ready", session_id: "call-1" }); });
    await screen.findByText("Microphone: On — speak naturally");
    const stopsBefore = stop.mock.calls.length;
    await act(async () => {
      if (termination === "clean-close") socket.onclose?.({ code: 1000 } as CloseEvent);
      else if (termination === "socket-error") { socket.onerror?.(new Event("error")); socket.onclose?.({ code: 1006 } as CloseEvent); }
      else socket.receive({ type: termination });
    });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByLabelText("Typed response")).not.toBeInTheDocument();
    expect(stop.mock.calls.length).toBeGreaterThan(stopsBefore);
  });

  it("intentional local end does not emit a connection error", async () => {
    const events: VoiceAgentEvent[] = [];
    const agent = makeAgent();
    await ready(agent, events);
    await agent.end();
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);
  });

  it("end before socket open settles startup and ignores late socket events", async () => {
    const agent = makeAgent();
    const events = vi.fn();
    const pending = agent.connect({ scenario, facts: [], onEvent: events });
    await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
    const socket = Socket.instances[0];
    const lateOpen = socket.onopen;
    const lateMessage = socket.onmessage;
    await agent.end();
    await pending;
    lateOpen?.(new Event("open"));
    lateMessage?.({ data: JSON.stringify({ type: "session.ready", session_id: "obsolete" }) } as MessageEvent);
    expect(socket.send).not.toHaveBeenCalled();
    expect(events).not.toHaveBeenCalled();
  });

  it("the console does not mark a late microphone acquisition as recording after end", async () => {
    const acquisition = deferred<MediaStream>();
    getUserMedia.mockReturnValue(acquisition.promise);
    const agent = makeAgent();
    render(React.createElement(CallConsole, { context, createAgent: () => agent }));
    fireEvent.click(screen.getByRole("button", { name: "Join voice call" }))
    await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
    const socket = Socket.instances[0];
    await act(async () => { socket.open(); socket.receive({ type: "session.ready", session_id: "call-1" }); });
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    await act(async () => { acquisition.resolve(stream); });
    expect(screen.getByText("Microphone: Not connected")).toBeVisible();
    expect(screen.getByText("ended")).toBeVisible();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("socket construction failure emits a normalized error", async () => {
    class UnavailableSocket extends Socket {
      constructor() { super(); throw new Error("construction failed"); }
    }
    const events: VoiceAgentEvent[] = [];
    const agent = new AssemblyAiVoiceAgent({ fetch: vi.fn().mockResolvedValue(token()), WebSocket: UnavailableSocket });
    await agent.connect({ scenario, facts: [], onEvent: (event) => events.push(event) }).catch(() => {});
    expect(events).toContainEqual(expect.objectContaining({ type: "error", code: "network" }));
  });
});
