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
type SpeechSynthesisLike = { speak: (utterance: SpeechSynthesisUtteranceLike) => void; cancel: () => void };
type SpeechSynthesisUtteranceLike = { text: string; onend: (() => void) | null; onerror: (() => void) | null };
type SpeechSynthesisUtteranceConstructor = new (text: string) => SpeechSynthesisUtteranceLike;

const mockFollowUp = (scenario: ScenarioDefinition, facts: ReferenceFact[]): string => {
  const fact = facts.find((candidate) => scenario.factIds.includes(candidate.id)) ?? facts[0];
  return fact
    ? `Thanks. Can you tell me what happens next under the ${fact.source} guidance?`
    : "Thanks. What is the next step you can offer me?";
};

/** Fixtures are used only when their spoken text exactly matches the current turn. */
const mockCustomerAudioFixtures: Record<string, string> = {
  "My order was meant to arrive already. Where is it?": "/voice/mock-customer-opening.wav",
  "Thanks. What is the next step you can offer me?": "/voice/mock-customer-follow-up.wav",
};

type CustomerAudioAvailability = "available" | "text-only";

export class MockVoiceAgent implements VoiceAgent {
  private onEvent?: (event: VoiceAgentEvent) => void;
  private scenario?: ScenarioDefinition;
  private facts: ReferenceFact[] = [];
  private customerSpeaking = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private recognition?: SpeechRecognitionLike;
  private microphoneActive = false;
  private activeCustomerTurn?: number;
  private nextCustomerTurn = 0;
  private fixturePlaybackPending = false;
  private customerAudioAvailability: CustomerAudioAvailability = "available";

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
    this.speechSynthesis()?.cancel();
    this.customerSpeaking = false;
    this.fixturePlaybackPending = false;
    this.activeCustomerTurn = undefined;
    this.emit({ type: "interrupted" });
  }

  /** Internal mock capability: the UI calls this when a matched fixture actually finishes playing. */
  completeCustomerAudioPlayback(): void {
    if (this.activeCustomerTurn !== undefined && this.fixturePlaybackPending) this.finishCustomerTurn(this.activeCustomerTurn);
  }

  /** Internal mock capability used only to label transcript-only fallback in the call UI. */
  getCustomerAudioAvailability(): CustomerAudioAvailability {
    return this.customerAudioAvailability;
  }

  requestMockCustomerTurn(): void {
    if (!this.scenario) return;
    this.interruptCustomer();
    this.emitCustomerTurn(mockFollowUp(this.scenario, this.facts));
  }

  async end(): Promise<void> {
    this.clearTimers();
    this.customerSpeaking = false;
    this.fixturePlaybackPending = false;
    this.activeCustomerTurn = undefined;
    this.recognition?.stop();
    this.recognition = undefined;
    this.onEvent = undefined;
  }

  private respondAfterTraineeTurn(): void {
    if (!this.scenario) return;
    this.schedule(() => this.emitCustomerTurn(mockFollowUp(this.scenario!, this.facts)), 250);
  }

  private emitCustomerTurn(text: string): void {
    const turn = ++this.nextCustomerTurn;
    this.customerSpeaking = true;
    this.activeCustomerTurn = turn;
    this.fixturePlaybackPending = false;
    this.customerAudioAvailability = "available";
    this.emit({ type: "customer-turn-started" });
    this.emit({ type: "customer-transcript", text, final: true });
    if (!this.speak(text, () => this.finishCustomerTurn(turn))) void this.emitFallbackAudio(text, turn);
  }

  private speak(text: string, onFinished: () => void): boolean {
    const synthesis = this.speechSynthesis();
    const Utterance = (globalThis as typeof globalThis & { SpeechSynthesisUtterance?: SpeechSynthesisUtteranceConstructor }).SpeechSynthesisUtterance;
    if (!synthesis || !Utterance) return false;
    const utterance = new Utterance(text) as unknown as SpeechSynthesisUtteranceLike;
    utterance.onend = onFinished;
    utterance.onerror = onFinished;
    try {
      synthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  private speechSynthesis(): SpeechSynthesisLike | undefined {
    return (globalThis as unknown as { speechSynthesis?: SpeechSynthesisLike }).speechSynthesis;
  }

  private async emitFallbackAudio(text: string, turn: number): Promise<void> {
    const fixture = mockCustomerAudioFixtures[text];
    if (!fixture) {
      this.customerAudioAvailability = "text-only";
      this.finishCustomerTurn(turn);
      return;
    }
    try {
      const response = await fetch(fixture);
      if (!response.ok) throw new Error("fixture unavailable");
      if (!this.isCurrentCustomerTurn(turn)) return;
      const audio = await response.arrayBuffer();
      if (!this.isCurrentCustomerTurn(turn)) return;
      this.fixturePlaybackPending = true;
      this.emit({ type: "customer-audio", audio });
    } catch {
      if (!this.isCurrentCustomerTurn(turn)) return;
      this.customerAudioAvailability = "text-only";
      this.finishCustomerTurn(turn);
    }
  }

  private isCurrentCustomerTurn(turn: number): boolean {
    return this.customerSpeaking && this.activeCustomerTurn === turn;
  }

  private finishCustomerTurn(turn: number): void {
    if (!this.isCurrentCustomerTurn(turn)) return;
    this.customerSpeaking = false;
    this.fixturePlaybackPending = false;
    this.activeCustomerTurn = undefined;
    this.emit({ type: "customer-turn-ended" });
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
