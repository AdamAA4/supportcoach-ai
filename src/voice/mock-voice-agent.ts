import type { ReferenceFact } from "../domain/reference-source";
import type { ScenarioDefinition } from "../domain/practice-pack";
import type { VoiceAgent, VoiceAgentEvent } from "./voice-agent";

type SpeechRecognitionResultEventLike = { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const mockFollowUp = (scenario: ScenarioDefinition, facts: ReferenceFact[]): string => {
  const fact = facts.find((candidate) => scenario.factIds.includes(candidate.id)) ?? facts[0];
  return fact
    ? `Thanks. Can you tell me what happens next under the ${fact.source} guidance?`
    : "Thanks. What is the next step you can offer me?";
};

export const createMockCustomerAudio = (): ArrayBuffer => {
  const sampleRate = 8_000;
  const samples = Math.floor(sampleRate * 0.18);
  const bytesPerSample = 2;
  const dataSize = samples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < samples; index += 1) {
    view.setInt16(44 + index * bytesPerSample, Math.round(Math.sin(index / 16) * 2_000), true);
  }
  return buffer;
};

export class MockVoiceAgent implements VoiceAgent {
  private onEvent?: (event: VoiceAgentEvent) => void;
  private scenario?: ScenarioDefinition;
  private facts: ReferenceFact[] = [];
  private customerSpeaking = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private recognition?: SpeechRecognitionLike;

  async connect(input: { scenario: ScenarioDefinition; facts: ReferenceFact[]; onEvent: (event: VoiceAgentEvent) => void }): Promise<void> {
    this.onEvent = input.onEvent;
    this.scenario = input.scenario;
    this.facts = input.facts;
    this.emit({ type: "session-ready", sessionId: "mock-session" });
    this.emitCustomerTurn(input.scenario.openingLine);
  }

  async startMicrophone(): Promise<void> {
    const recognitionConstructor = (globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (globalThis as typeof globalThis & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!recognitionConstructor) throw new Error("Speech recognition is unavailable. Use typed fallback.");

    this.recognition = new recognitionConstructor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.onstart = () => this.interruptCustomer();
    this.recognition.onresult = (event) => {
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        this.emit({ type: "trainee-transcript", text: result[0].transcript.trim(), final: result.isFinal });
        if (result.isFinal) this.respondAfterTraineeTurn();
      }
    };
    this.recognition.onerror = (event) => this.emit({ type: "error", code: "permission-denied", message: `Microphone recognition failed: ${event.error}` });
    this.recognition.start();
  }

  sendTypedTraineeTurn(text: string): void {
    const normalizedText = text.trim();
    if (!normalizedText) return;
    this.interruptCustomer();
    this.emit({ type: "trainee-transcript", text: normalizedText, final: true });
    this.respondAfterTraineeTurn();
  }

  interruptCustomer(): void {
    if (!this.customerSpeaking) return;
    this.clearTimers();
    this.customerSpeaking = false;
    this.emit({ type: "interrupted" });
  }

  requestMockCustomerTurn(): void {
    if (!this.scenario) return;
    this.interruptCustomer();
    this.emitCustomerTurn(mockFollowUp(this.scenario, this.facts));
  }

  async end(): Promise<void> {
    this.clearTimers();
    this.customerSpeaking = false;
    this.recognition?.stop();
    this.recognition = undefined;
    this.onEvent = undefined;
  }

  private respondAfterTraineeTurn(): void {
    if (!this.scenario) return;
    this.schedule(() => this.emitCustomerTurn(mockFollowUp(this.scenario!, this.facts)), 250);
  }

  private emitCustomerTurn(text: string): void {
    this.customerSpeaking = true;
    this.emit({ type: "customer-turn-started" });
    this.emit({ type: "customer-audio", audio: createMockCustomerAudio() });
    this.emit({ type: "customer-transcript", text, final: true });
    this.schedule(() => {
      this.customerSpeaking = false;
      this.emit({ type: "customer-turn-ended" });
    }, 400);
  }

  private schedule(callback: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  private emit(event: VoiceAgentEvent): void {
    this.onEvent?.(event);
  }
}
