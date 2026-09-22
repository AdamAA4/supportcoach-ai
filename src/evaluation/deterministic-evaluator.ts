import type { Evaluator } from "./evaluator";
import type { SourceProvenance } from "../domain/reference-source";
import type { CoachingReport } from "../domain/report";
import type { Score } from "../domain/practice-pack";
import { matchReferenceFacts } from "./structured-fact-matcher";
import { buildPracticeTask } from "./practice-task";

const words = (text: string): string[] => text.toLowerCase()
  .replace(/\bisn[’']t\b/g, "is not")
  .replace(/\baren[’']t\b/g, "are not")
  .replace(/\bwasn[’']t\b/g, "was not")
  .replace(/\bweren[’']t\b/g, "were not")
  .replace(/\bdon[’']t\b/g, "do not")
  .replace(/\bdoesn[’']t\b/g, "does not")
  .replace(/\bwon[’']t\b/g, "will not")
  .replace(/\bcan[’']t\b/g, "cannot")
  .match(/[a-z0-9]+/g) ?? [];
const sentences = (text: string): string[] => text.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
const score = (value: number): Score => Math.max(0, Math.min(3, Math.round(value))) as Score;

export class DeterministicEvaluator implements Evaluator {
  constructor(private readonly provenance: SourceProvenance) {}
  async evaluate({ scenario, facts, notes, transcript }: Parameters<Evaluator["evaluate"]>[0]): Promise<CoachingReport> {
    const traineeSentences = transcript.filter((turn) => turn.speaker === "trainee").flatMap((turn) => sentences(turn.text));
    const traineeText = traineeSentences.join(" ");
    // Normalization uses note-* IDs for advice. Advice never establishes factual policy.
    const referenceFacts = facts.filter((fact) => !fact.id.startsWith("note-") && scenario.factIds.includes(fact.id));
    const factual = matchReferenceFacts(
      referenceFacts,
      traineeSentences.map((text) => ({ text, isQuestion: text.endsWith("?") })),
    );
    const missedFacts = referenceFacts
      .filter((fact) => !factual.supportedFactIds.has(fact.id))
      .map((fact) => fact.answer);
    const unsupportedClaims = factual.unsupportedClaims;
    const acknowledgement = /\b(?:understand|that sounds|i hear|recognize|appreciate)\b/i.test(traineeText);
    const apology = /\b(?:sorry|apologize|apologise)\b/i.test(traineeText);
    const nextStep = /\b(?:next|i will|i'll|let me|please|check|send|review)\b/i.test(traineeText);
    const escalation = /\b(?:escalate|supervisor|contact support|support team|follow up)\b/i.test(traineeText);
    const concise = traineeSentences.length > 0 && traineeSentences.every((sentence) => words(sentence).length <= 25);
    const direct = traineeSentences.some((sentence) => !sentence.endsWith("?") && /\b(?:is|are|takes|can|will|please|check|send)\b/i.test(sentence));
    const factualAccuracy = referenceFacts.length ? score(3 * (referenceFacts.length - missedFacts.length) / referenceFacts.length - unsupportedClaims.length) : 0;
    const fullFactualCoverage = referenceFacts.length > 0 && missedFacts.length === 0 && unsupportedClaims.length === 0;
    const grounded = factual.supportedFactIds.size > 0 && unsupportedClaims.length === 0;
    const personalNote = notes.find((note) => note.kind === "personal-coaching-note" && note.text.trim());
    const scores = { factualAccuracy, empathy: score(Number(acknowledgement) * 2 + Number(apology)), clarity: grounded ? score(1 + Number(direct) + Number(concise)) : 0, resolution: score(Number(nextStep) * 2 + Number(escalation)) };
    const focusFact = missedFacts.length && missedFacts[0].length > 180 ? `${missedFacts[0].slice(0, 177).trimEnd()}...` : missedFacts.length ? missedFacts[0] : "";
    return {
      callId: crypto.randomUUID(), scenarioId: scenario.id, completedAt: new Date().toISOString(),
      scores,
      strengths: [
        fullFactualCoverage ? "You stated the confirmed reference facts accurately." : missedFacts.length < referenceFacts.length ? "You stated some confirmed reference facts accurately." : "No factual strength was demonstrated in this attempt.",
        acknowledgement || apology ? "You acknowledged the customer's experience." : nextStep ? "You offered a concrete next step." : concise ? "You kept your sentences concise." : "No communication strength was demonstrated in this attempt.",
      ],
      missedFacts, unsupportedClaims,
      nextExercise: `Repeat ${scenario.title.toLowerCase()}: ${missedFacts.length ? `state this confirmed answer, then offer a next step: ${focusFact}` : "acknowledge the concern, give the confirmed answer, and explain the next step."}${personalNote ? ` Coaching reminder: ${personalNote.text.trim()}` : ""}`,
      practice: buildPracticeTask({ scenario, referenceFacts, missedFacts, unsupportedClaims, scores }),
      transcript: transcript.map((turn) => ({ ...turn })), sourceProvenance: Object.freeze({ ...this.provenance }),
    };
  }
}
