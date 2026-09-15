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

const pcmToWav = (pcm: Uint8Array, sampleRate = 24_000): ArrayBuffer => {
  const wav = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(wav);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + pcm.byteLength, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(wav, 44).set(pcm);
  return wav;
};

const promptFor = (scenario: ScenarioDefinition, facts: ReferenceFact[]): string => [
  "You are a simulated customer in a support-practice exercise, never a real customer support assistant.",
  "The trainee is the support responder. Stay in character as the customer and do not answer the trainee's customer questions for them.",
  `Scenario: ${scenario.title}.`,
  `Customer persona: ${scenario.customerPersona}.`,
  `Opening line: ${scenario.openingLine}.`,
  `Customer goals: ${scenario.goals.join("; ") || "Ask for help with the scenario."}.`,
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
  private closed = false;
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private microphoneSource?: MediaStreamAudioSourceNode;
  private processor?: ScriptProcessorNode;
  private muteGain?: GainNode;

  constructor(dependencies: AssemblyAiVoiceAgentDependencies = {}) {
    this.request = dependencies.fetch ?? fetch;
    this.Socket = dependencies.WebSocket ?? WebSocket;
    this.mediaDevices = dependencies.mediaDevices ?? (typeof navigator === "undefined" ? undefined : navigator.mediaDevices);
    this.AudioContext = dependencies.AudioContext ?? (typeof window === "undefined" ? undefined : window.AudioContext);
  }

  async connect(input: { scenario: ScenarioDefinition; facts: ReferenceFact[]; onEvent: (event: VoiceAgentEvent) => void }): Promise<void> {
    await this.end();
    this.closed = false;
    this.onEvent = input.onEvent;
    let token: string;
    try {
      const response = await this.request(VOICE_TOKEN_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("token-request");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || typeof (payload as { token?: unknown }).token !== "string") throw new Error("token-payload");
      token = (payload as { token: string }).token;
    } catch {
      this.fail("network", "The live voice service could not be reached.");
      throw new Error("Voice token request failed.");
    }

    await new Promise<void>((resolve, reject) => {
      const url = new URL(VOICE_SOCKET_URL);
      url.searchParams.set("token", token);
      const socket = new this.Socket(url.toString());
      this.socket = socket;
      socket.onopen = () => {
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
      socket.onmessage = (event) => this.handleMessage(event);
      socket.onerror = () => {
        if (this.closed) return;
        this.fail("network", "The live voice connection failed.");
        reject(new Error("Voice socket failed."));
      };
      socket.onclose = (event) => {
        if (this.closed || event.code === 1000) return;
        this.fail("network", "The live voice connection closed unexpectedly.");
      };
    });
  }

  async startMicrophone(): Promise<void> {
    if (!this.mediaDevices || !this.AudioContext) {
      this.fail("permission-denied", "Microphone capture is unavailable. Use typed fallback.");
      return;
    }
    try {
      this.stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, sampleRate: 24_000, channelCount: 1 } });
      this.audioContext = new this.AudioContext({ sampleRate: 24_000 });
      this.microphoneSource = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.muteGain = this.audioContext.createGain();
      this.muteGain.gain.value = 0;
      this.processor.onaudioprocess = (event) => {
        if (!this.sessionReady || !this.socket || this.socket.readyState !== 1) return;
        const samples = event.inputBuffer.getChannelData(0);
        const pcm = new Uint8Array(samples.length * 2);
        const view = new DataView(pcm.buffer);
        for (let index = 0; index < samples.length; index += 1) view.setInt16(index * 2, Math.max(-1, Math.min(1, samples[index])) * 0x7fff, true);
        this.send({ type: "input.audio", audio: asBase64(pcm) });
      };
      this.microphoneSource.connect(this.processor);
      this.processor.connect(this.muteGain);
      this.muteGain.connect(this.audioContext.destination);
      await this.audioContext.resume();
      logEvent("microphone-started", this.callId);
    } catch {
      await this.releaseMicrophone();
      this.fail("permission-denied", "Microphone permission was denied. Use typed fallback.");
    }
  }

  sendTypedTraineeTurn(text: string): void {
    const normalized = text.trim();
    if (!normalized || !this.sessionReady) return;
    this.emit({ type: "trainee-transcript", text: normalized, final: true });
    this.send({ type: "conversation.message", role: "user", content: normalized });
    this.send({ type: "reply.create" });
  }

  interruptCustomer(): void {
    if (!this.sessionReady) return;
    this.emit({ type: "interrupted" });
  }

  async end(): Promise<void> {
    if (this.closed && !this.socket && !this.stream) return;
    this.closed = true;
    this.sessionReady = false;
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      try { if (socket.readyState === 1) socket.send(JSON.stringify({ type: "session.end" })); } catch { /* socket is already unavailable */ }
      try { socket.close(); } catch { /* socket is already unavailable */ }
    }
    await this.releaseMicrophone();
    this.onEvent = undefined;
    logEvent("session-ended", this.callId);
    this.callId = undefined;
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
        try { this.emit({ type: "customer-audio", audio: pcmToWav(decodeBase64(message.data)) }); }
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
        this.fail("protocol", "The live voice service rejected the session.");
        return;
      case "session.ended":
        void this.end();
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

  private fail(code: Extract<VoiceAgentEvent, { type: "error" }>["code"], message: string): void {
    if (this.closed) return;
    this.emit({ type: "error", code, message });
    logEvent("error", this.callId, code);
    void this.end();
  }

  private async releaseMicrophone(): Promise<void> {
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
