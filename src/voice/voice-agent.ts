import type { ScenarioDefinition } from "../domain/practice-pack";
import type { ReferenceFact } from "../domain/reference-source";

export type VoiceAgentEvent =
  | { type: "session-ready"; sessionId: string }
  | { type: "customer-transcript"; text: string; final: boolean }
  | { type: "trainee-transcript"; text: string; final: boolean }
  | { type: "customer-audio"; audio: ArrayBuffer }
  | { type: "customer-turn-started" }
  | { type: "customer-turn-ended" }
  | { type: "interrupted" }
  | { type: "error"; code: "permission-denied" | "network" | "audio-playback" | "protocol"; message: string };

export interface VoiceAgent {
  connect(input: {
    scenario: ScenarioDefinition;
    facts: ReferenceFact[];
    onEvent: (event: VoiceAgentEvent) => void;
  }): Promise<void>;
  startMicrophone(): Promise<void>;
  sendTypedTraineeTurn(text: string): void;
  interruptCustomer(): void;
  end(): Promise<void>;
}

export type CallState = "idle" | "connecting" | "customer-speaking" | "listening" | "processing" | "ended" | "error";

export type CallStateEvent =
  | { type: "connect" }
  | { type: "session-ready" }
  | { type: "customer-turn-started" }
  | { type: "customer-turn-ended" }
  | { type: "trainee-turn-finalized" }
  | { type: "interrupted" }
  | { type: "end" }
  | { type: "error" }
  | { type: "retry" };

export const reduceCallState = (state: CallState, event: CallStateEvent): CallState => {
  if (state === "error") return event.type === "retry" ? "connecting" : "error";
  if (state === "ended") return state;

  switch (event.type) {
    case "connect": return state === "idle" ? "connecting" : state;
    case "customer-turn-started": return "customer-speaking";
    case "customer-turn-ended": return state === "customer-speaking" ? "listening" : state;
    case "trainee-turn-finalized": return state === "listening" ? "processing" : state;
    case "interrupted": return state === "customer-speaking" ? "listening" : state;
    case "end": return "ended";
    case "error": return "error";
    default: return state;
  }
};
