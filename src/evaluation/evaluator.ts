import type { ScenarioDefinition } from "../domain/practice-pack";
import type { ReferenceFact, ExperienceNote } from "../domain/reference-source";
import type { TranscriptTurn } from "../domain/transcript";
import type { CoachingReport } from "../domain/report";

export interface Evaluator {
  evaluate(input: {
    scenario: ScenarioDefinition;
    facts: ReferenceFact[];
    notes: ExperienceNote[];
    transcript: TranscriptTurn[];
  }): Promise<CoachingReport>;
}
