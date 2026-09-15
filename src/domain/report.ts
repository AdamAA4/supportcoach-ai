import type { Score } from "./practice-pack";
import type { SourceProvenance } from "./reference-source";
import type { TranscriptTurn } from "./transcript";

export type CoachingReport = {
  callId: string;
  scenarioId: string;
  completedAt: string;
  scores: {
    factualAccuracy: Score;
    empathy: Score;
    clarity: Score;
    resolution: Score;
  };
  strengths: string[];
  missedFacts: string[];
  unsupportedClaims: string[];
  nextExercise: string;
  transcript: TranscriptTurn[];
  sourceProvenance: SourceProvenance;
};
