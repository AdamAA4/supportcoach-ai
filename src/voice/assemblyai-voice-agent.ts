import type { ScenarioDefinition } from "../domain/practice-pack";
import type { ReferenceFact } from "../domain/reference-source";
import { MockVoiceAgent } from "./mock-voice-agent";
import type { VoiceAgent, VoiceAgentEvent } from "./voice-agent";

const VOICE_TOKEN_URL = "/api/voice-token";
const VOICE_SOCKET_URL = "wss://agents.assemblyai.com/v1/ws";

export type VoiceSocketLike = {
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send: (data: string) => void;
  close: () => void;
};

export type VoiceSocketConstructor = new (url: string | URL) => VoiceSocketLike;
type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

export type AssemblyAiVoiceAgentDependencies = {
  fetch?: typeof fetch;
  WebSocket?: VoiceSocketConstructor;
  mediaDevices?: MediaDevices;
  AudioContext?: AudioContextConstructor;
};

type ProviderEvent = { type?: unknown; [key: string]: unknown };

const logEvent = (event: string, callId?: string, code?: string) => {
  if (process.env.NODE_ENV === "development") console.info("voice-agent", { event, callId, code });
};

const asBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const resampleTo24k = (samples: Float32Array, sourceRate: number): Float32Array => {
  if (sourceRate === 24_000) return samples;
  const targetLength = Math.max(1, Math.floor(samples.length * 24_000 / sourceRate));
  const result = new Float32Array(targetLength);
  const ratio = sourceRate / 24_000;
  for (let index = 0; index < targetLength; index += 1) result[index] = samples[Math.min(samples.length - 1, Math.floor(index * ratio))];
  return result;
};

const promptFor = (scenario: ScenarioDefinition, facts: ReferenceFact[]): string => [
  "You are a simulated customer in a support-practice exercise, never a real customer support assistant.",
  "The trainee is the support responder. Stay in character as the customer and do not answer the trainee's customer questions for them.",
  `Scenario: ${scenario.title}.`,
  `Customer persona: ${scenario.customerPersona}.`,
  `Opening line: ${scenario.openingLine}.`,
  `Customer goals: ${scenario.goals.join("; ") || "Ask for help with the scenario."}.`,
  "After every trainee answer, react to its specific content with one concise realistic follow-up. Never repeat the opening line after the first turn.",
  "Use only these confirmed FAQ/policy facts when reacting to the trainee's answer:",
  ...facts.map((fact) => `- ${fact.question}: ${fact.answer}`),
].join("\n");

export class AssemblyAiVoiceAgent implements VoiceAgent {
  private readonly request: typeof fetch;
  private readonly Socket: VoiceSocketConstructor;
  private readonly mediaDevices?: MediaDevices;
  private readonly AudioContext?: AudioContextConstructor;
  private socket?: VoiceSocketLike;
  private onEvent?: (event: VoiceAgentEvent) => void;
  private callId?: string;
  private sessionReady = false;
  private closed = true;
  private generation = 0;
  private connectionTask?: Promise<void>;
  private microphoneTask?: Promise<void>;
  private tokenController?: AbortController;
  private settleConnection?: () => void;
  private muted = false;
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private microphoneSource?: MediaStreamAudioSourceNode;
  private processor?: ScriptProcessorNode;
  private muteGain?: GainNode;

  constructor(dependencies: AssemblyAiVoiceAgentDependencies = {}) {
    // Browser fetch is a Window method in Firefox and Chromium. Keep its global
    // receiver when the adapter invokes it later, or token minting fails before
    // any request reaches the server.
    this.request = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.Socket = dependencies.WebSocket ?? WebSocket;
    this.mediaDevices = dependencies.mediaDevices ?? (typeof navigator === "undefined" ? undefined : navigator.mediaDevices);
    this.AudioContext = dependencies.AudioContext ?? (typeof window === "undefined" ? undefined : window.AudioContext);
  }

  connect(input: { scenario: ScenarioDefinition; facts: ReferenceFact[]; onEvent: (event: VoiceAgentEvent) => void }): Promise<void> {
    if (this.connectionTask) return this.connectionTask;
    if (!this.closed) return Promise.resolve();
    this.closed = false;
    this.muted = false;
    this.onEvent = input.onEvent;
    const generation = ++this.generation;
    this.tokenController = new AbortController();
    const task = this.openConnection(input, generation, this.tokenController.signal);
    this.connectionTask = task;
    void task.finally(() => { if (this.connectionTask === task) this.connectionTask = undefined; }).catch(() => {});
    return task;
  }

  private async openConnection(input: Parameters<VoiceAgent["connect"]>[0], generation: number, signal: AbortSignal): Promise<void> {
    let token: string;
    try {
      const response = await this.request(VOICE_TOKEN_URL, { cache: "no-store", signal });
      if (!this.isCurrent(generation)) return;
      if (!response.ok) throw new Error("token-request");
      const payload: unknown = await response.json();
      if (!this.isCurrent(generation)) return;
      if (!payload || typeof payload !== "object" || typeof (payload as { token?: unknown }).token !== "string") throw new Error("token-payload");
      token = (payload as { token: string }).token;
    } catch {
      if (!this.isCurrent(generation)) return;
      this.fail("network", "The live voice service could not be reached.");
      throw new Error("Voice token request failed.");
    }

    await new Promise<void>((resolve, reject) => {
      if (!this.isCurrent(generation)) { resolve(); return; }
      this.settleConnection = resolve;
      const url = new URL(VOICE_SOCKET_URL);
      url.searchParams.set("token", token);
      const socket = new this.Socket(url.toString());
      this.socket = socket;
      socket.onopen = () => {
        if (!this.isCurrent(generation)) return;
        try {
          this.send({
            type: "session.update",
            session: {
              system_prompt: promptFor(input.scenario, input.facts),
              greeting: input.scenario.openingLine,
              input: { format: { encoding: "audio/pcm" }, turn_detection: { interrupt_response: true } },
              output: { voice: "alba", format: { encoding: "audio/pcm" } },
            },
          });
          logEvent("socket-open");
          resolve();
        } catch {
          this.fail("protocol", "The live voice service sent an invalid session response.");
          reject(new Error("Voice session configuration failed."));
        }
      };
      socket.onmessage = (event) => { if (this.isCurrent(generation)) this.handleMessage(event); };
      socket.onerror = () => {
        if (!this.isCurrent(generation)) return;
        // Browsers intentionally hide WebSocket handshake details here. Wait for
        // close so the user receives its safe numeric close code instead.
        logEvent("socket-error");
      };
      socket.onclose = (event) => {
        if (!this.isCurrent(generation)) return;
        const code = Number.isInteger(event.code) ? event.code : 0;
        const message = `The live voice connection closed before it was ready (code ${code}).`;
        this.fail("network", message);
        reject(new Error(message));
      };
    }).catch(() => {
      if (!this.isCurrent(generation)) return;
      this.fail("network", "The live voice connection could not be opened.");
      throw new Error("Voice socket startup failed.");
    });
  }

  startMicrophone(): Promise<void> {
    if (this.closed || this.stream) return Promise.resolve();
    if (this.microphoneTask) return this.microphoneTask;
    const task = this.acquireMicrophone(this.generation);
    this.microphoneTask = task;
    void task.finally(() => { if (this.microphoneTask === task) this.microphoneTask = undefined; }).catch(() => {});
    return task;
  }

  private async acquireMicrophone(generation: number): Promise<void> {
    if (!this.mediaDevices || !this.AudioContext) {
      this.emit({ type: "error", code: "permission-denied", message: "Microphone capture is unavailable in this browser." });
      return;
    }
    try {
      const stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, channelCount: 1 } });
      if (!this.isCurrent(generation)) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      stream.getTracks().forEach((track) => { track.enabled = !this.muted; });
      this.audioContext = new this.AudioContext();
      this.microphoneSource = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.muteGain = this.audioContext.createGain();
      this.muteGain.gain.value = 0;
      this.processor.onaudioprocess = (event) => {
        if (!this.isCurrent(generation) || this.muted || !this.sessionReady || !this.socket || this.socket.readyState !== 1) return;
        const samples = resampleTo24k(event.inputBuffer.getChannelData(0), this.audioContext?.sampleRate ?? 24_000);
        const pcm = new Uint8Array(samples.length * 2);
        const view = new DataView(pcm.buffer);
        for (let index = 0; index < samples.length; index += 1) view.setInt16(index * 2, Math.max(-1, Math.min(1, samples[index])) * 0x7fff, true);
        try { this.send({ type: "input.audio", audio: asBase64(pcm) }); }
        catch { this.fail("network", "The live voice connection failed."); }
      };
      this.microphoneSource.connect(this.processor);
      this.processor.connect(this.muteGain);
      this.muteGain.connect(this.audioContext.destination);
      await this.audioContext.resume();
      if (!this.isCurrent(generation)) return;
      logEvent("microphone-started", this.callId);
    } catch {
      if (!this.isCurrent(generation)) return;
      await this.releaseMicrophone();
      if (this.isCurrent(generation)) this.emit({ type: "error", code: "permission-denied", message: "Microphone permission was denied." });
    }
  }

  /** Optional adapter capability: preserve the capture graph while pausing transmission. */
  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted;
    this.stream?.getTracks().forEach((track) => { track.enabled = !muted; });
  }

  // Retained for the shared adapter contract. Live SupportCoach calls are voice-only.
  sendTypedTraineeTurn(_text?: string): void { void _text; }

  interruptCustomer(): void {
    if (!this.sessionReady) return;
    this.emit({ type: "interrupted" });
  }

  async end(): Promise<void> {
    if (this.closed && !this.socket && !this.stream) return;
    this.closed = true;
    this.generation += 1;
    this.sessionReady = false;
    this.tokenController?.abort();
    this.tokenController = undefined;
    this.connectionTask = undefined;
    this.microphoneTask = undefined;
    this.settleConnection?.();
    this.settleConnection = undefined;
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null;
      try { if (socket.readyState === 1) socket.send(JSON.stringify({ type: "session.end" })); } catch { /* socket is already unavailable */ }
      try { socket.close(); } catch { /* socket is already unavailable */ }
    }
    this.onEvent = undefined;
    logEvent("session-ended", this.callId);
    this.callId = undefined;
    await this.releaseMicrophone();
  }

  private handleMessage(event: MessageEvent): void {
    let message: ProviderEvent;
    try {
      if (typeof event.data !== "string") throw new Error("non-text");
      message = JSON.parse(event.data) as ProviderEvent;
      if (typeof message.type !== "string") throw new Error("missing-type");
    } catch {
      this.fail("protocol", "The live voice service returned an invalid event.");
      return;
    }

    switch (message.type) {
      case "session.ready": {
        if (typeof message.session_id !== "string") { this.fail("protocol", "The live voice service returned an invalid session."); return; }
        this.callId = message.session_id;
        this.sessionReady = true;
        this.emit({ type: "session-ready", sessionId: message.session_id });
        logEvent("session-ready", this.callId);
        return;
      }
      case "input.speech.started":
        this.emit({ type: "interrupted" });
        return;
      case "transcript.user.delta":
        if (typeof message.text === "string") this.emit({ type: "trainee-transcript", text: message.text, final: false });
        return;
      case "transcript.user":
        if (typeof message.text === "string") this.emit({ type: "trainee-transcript", text: message.text, final: true });
        return;
      case "reply.started":
        this.emit({ type: "customer-turn-started" });
        return;
      case "reply.audio":
        if (typeof message.data !== "string") { this.fail("protocol", "The live voice service returned invalid audio."); return; }
        try { const pcm = decodeBase64(message.data); this.emit({ type: "customer-audio", audio: pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer }); }
        catch { this.fail("protocol", "The live voice service returned invalid audio."); }
        return;
      case "transcript.agent":
        if (typeof message.text === "string") this.emit({ type: "customer-transcript", text: message.text, final: true });
        return;
      case "transcript.agent.delta":
        if (typeof message.delta === "string") this.emit({ type: "customer-transcript", text: message.delta, final: false });
        return;
      case "reply.done":
        this.emit(message.status === "interrupted" ? { type: "interrupted" } : { type: "customer-turn-ended" });
        return;
      case "session.error":
        this.fail("protocol", `The live voice service rejected the session (${typeof message.code === "string" ? message.code : "unknown"}).`);
        return;
      case "session.ended":
        this.fail("network", "The live voice session ended. Start a new practice call.");
        return;
      default:
        return;
    }
  }

  private send(payload: object): void {
    if (!this.socket || this.socket.readyState !== 1) throw new Error("socket-not-open");
    this.socket.send(JSON.stringify(payload));
  }

  private emit(event: VoiceAgentEvent): void {
    this.onEvent?.(event);
  }

  private isCurrent(generation: number): boolean {
    return !this.closed && this.generation === generation;
  }

  private fail(code: Extract<VoiceAgentEvent, { type: "error" }>["code"], message: string): void {
    if (this.closed) return;
    this.emit({ type: "error", code, message });
    logEvent("error", this.callId, code);
    void this.end();
  }

  private async releaseMicrophone(): Promise<void> {
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect();
    this.microphoneSource?.disconnect();
    this.muteGain?.disconnect();
    this.processor = undefined;
    this.microphoneSource = undefined;
    this.muteGain = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    const context = this.audioContext;
    this.audioContext = undefined;
    if (context && context.state !== "closed") await context.close();
  }
}

export const createConfiguredVoiceAgent = (): VoiceAgent =>
  process.env.NEXT_PUBLIC_VOICE_MODE === "live" ? new AssemblyAiVoiceAgent() : new MockVoiceAgent();
