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

/** Spoken, browser-playable WAV fixture for deterministic mock customer playback. */
export const mockCustomerAudioFixture = "/voice/mock-customer-opening.wav";
export const mockCustomerFollowUpAudioFixture = "/voice/mock-customer-follow-up.wav";

export class MockVoiceAgent implements VoiceAgent {
  private onEvent?: (event: VoiceAgentEvent) => void;
  private scenario?: ScenarioDefinition;
  private facts: ReferenceFact[] = [];
  private customerSpeaking = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private recognition?: SpeechRecognitionLike;
  private microphoneActive = false;

  async connect(input: { scenario: ScenarioDefinition; facts: ReferenceFact[]; onEvent: (event: VoiceAgentEvent) => void }): Promise<void> {
    this.onEvent = input.onEvent;
    this.scenario = input.scenario;
    this.facts = input.facts;
    this.emit({ type: "session-ready", sessionId: "mock-session" });
    this.emitCustomerTurn(input.scenario.openingLine, mockCustomerAudioFixture);
  }

  async startMicrophone(): Promise<void> {
    const recognitionConstructor = (globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (globalThis as typeof globalThis & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!recognitionConstructor) throw new Error("Speech recognition is unavailable. Use typed fallback.");

    this.recognition = new recognitionConstructor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.onstart = () => { this.microphoneActive = true; this.interruptCustomer(); };
    this.recognition.onresult = (event) => {
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        this.emit({ type: "trainee-transcript", text: result[0].transcript.trim(), final: result.isFinal });
        if (result.isFinal) this.respondAfterTraineeTurn();
      }
    };
    this.recognition.onerror = (event) => { this.microphoneActive = false; this.emit({ type: "error", code: "permission-denied", message: `Microphone recognition failed: ${event.error}` }); };
    this.recognition.onend = () => { this.microphoneActive = false; };
    this.recognition.start();
  }

  async setMuted(muted: boolean): Promise<void> {
    if (muted) {
      this.recognition?.stop();
      this.microphoneActive = false;
      return;
    }
    if (this.recognition && !this.microphoneActive) this.recognition.start();
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
    this.emitCustomerTurn(mockFollowUp(this.scenario, this.facts), mockCustomerFollowUpAudioFixture);
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
    this.schedule(() => this.emitCustomerTurn(mockFollowUp(this.scenario!, this.facts), mockCustomerFollowUpAudioFixture), 250);
  }

  private emitCustomerTurn(text: string, fixtureUrl: string): void {
    this.customerSpeaking = true;
    this.emit({ type: "customer-turn-started" });
    this.emit({ type: "customer-audio", audio: new ArrayBuffer(0), fixtureUrl });
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
