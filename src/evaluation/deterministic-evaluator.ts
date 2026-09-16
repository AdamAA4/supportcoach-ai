import type { Evaluator } from "./evaluator";
import type { SourceProvenance } from "../domain/reference-source";
import type { CoachingReport } from "../domain/report";
import type { Score } from "../domain/practice-pack";

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
const factualClauses = (sentence: string): string[] => sentence
  .split(/(?:\s*;\s*|\s*,\s*(?:but|however)\s+|\s+(?:but|however)\s+)/i)
  .map((clause) => clause.trim())
  .filter(Boolean);
const score = (value: number): Score => Math.max(0, Math.min(3, Math.round(value))) as Score;
const oppositePairs = [["unopened", "opened"], ["before", "after"], ["within", "outside"], ["eligible", "ineligible"], ["available", "unavailable"]];
const commonWords = new Set(["a", "an", "the", "is", "are", "be", "can", "will", "for", "to", "of", "in", "on", "and", "or", "when", "what", "where", "how", "my", "your", "within", "before", "after", "with", "not"]);
const negators = new Set(["not", "never", "no", "cannot", "cant"]);
const negationFillers = new Set(["currently", "generally", "normally", "ordinarily", "really", "typically", "usually"]);
const factNegated = (actual: string[], expected: string[]): boolean => actual.some((word, index) => {
  if (!negators.has(word)) return false;
  for (let offset = 1; offset <= 3; offset += 1) {
    const candidate = actual[index + offset];
    if (!candidate) return false;
    if (negationFillers.has(candidate) || commonWords.has(candidate)) continue;
    return expected.includes(candidate) && !commonWords.has(candidate);
  }
  return false;
});

// Deliberately conservative lexical rubric: omitted conditions do not earn credit.
// This is practice feedback, not general-purpose semantic policy verification.
const assess = (answer: string, keywords: string[], sentence: string) => {
  const expected = words(answer);
  const actual = words(sentence);
  const relevant = [...keywords.flatMap(words), ...expected].filter((word) => !commonWords.has(word)).some((word) => actual.includes(word));
  const question = sentence.endsWith("?");
  const expectedNumbers = expected.filter((word) => /^\d+$/.test(word));
  const actualNumbers = actual.filter((word) => /^\d+$/.test(word));
  const conflictingNumbers = actualNumbers.length > 0 && expectedNumbers.length > 0 && actualNumbers.some((number) => !expectedNumbers.includes(number));
  const opposite = oppositePairs.some(([a, b]) => (expected.includes(a) && actual.includes(b)) || (expected.includes(b) && actual.includes(a)));
  const removesConditions = /\b(?:within|before|after|unopened|only|if)\b/i.test(answer) && /\b(?:always|regardless|all items|no conditions)\b/i.test(sentence) && !/\b(?:always|regardless|all items|no conditions)\b/i.test(answer);
  const conflict = relevant && !question && (conflictingNumbers || opposite || removesConditions || factNegated(expected, expected) !== factNegated(actual, expected));
  const supported = relevant && !question && !conflict && expected.every((word) => actual.includes(word));
  return { supported, conflict };
};

export class DeterministicEvaluator implements Evaluator {
  constructor(private readonly provenance: SourceProvenance) {}
  async evaluate({ scenario, facts, notes, transcript }: Parameters<Evaluator["evaluate"]>[0]): Promise<CoachingReport> {
    const traineeSentences = transcript.filter((turn) => turn.speaker === "trainee").flatMap((turn) => sentences(turn.text));
    const traineeText = traineeSentences.join(" ");
    // Normalization uses note-* IDs for advice. Advice never establishes factual policy.
    const referenceFacts = facts.filter((fact) => !fact.id.startsWith("note-") && scenario.factIds.includes(fact.id));
    const missedFacts: string[] = [];
    const unsupportedClaims = new Set<string>();
    const traineeClauses = traineeSentences.flatMap((sentence) => factualClauses(sentence).map((clause) => ({ clause, sentence })));
    const supportedClauses = new Set(traineeClauses.filter(({ clause }) => referenceFacts.some((fact) => assess(fact.answer, fact.keywords, clause).supported)));
    for (const fact of referenceFacts) {
      let supported = false;
      for (const candidate of traineeClauses) {
        const result = assess(fact.answer, fact.keywords, candidate.clause);
        supported ||= result.supported;
        if (result.conflict && !supportedClauses.has(candidate)) unsupportedClaims.add(candidate.sentence);
      }
      if (!supported) missedFacts.push(fact.answer);
    }
    const acknowledgement = /\b(?:understand|that sounds|i hear|recognize|appreciate)\b/i.test(traineeText);
    const apology = /\b(?:sorry|apologize|apologise)\b/i.test(traineeText);
    const nextStep = /\b(?:next|i will|i'll|let me|please|check|send|review)\b/i.test(traineeText);
    const escalation = /\b(?:escalate|supervisor|contact support|support team|follow up)\b/i.test(traineeText);
    const concise = traineeSentences.length > 0 && traineeSentences.every((sentence) => words(sentence).length <= 25);
    const direct = traineeSentences.some((sentence) => !sentence.endsWith("?") && /\b(?:is|are|takes|can|will|please|check|send)\b/i.test(sentence));
    const factualAccuracy = referenceFacts.length ? score(3 * (referenceFacts.length - missedFacts.length) / referenceFacts.length - unsupportedClaims.size) : 0;
    const personalNote = notes.find((note) => note.kind === "personal-coaching-note" && note.text.trim());
    return {
      callId: crypto.randomUUID(), scenarioId: scenario.id, completedAt: new Date().toISOString(),
      scores: { factualAccuracy, empathy: score(Number(acknowledgement) * 2 + Number(apology)), clarity: score(Number(concise) + Number(direct) * 2), resolution: score(Number(nextStep) * 2 + Number(escalation)) },
      strengths: [
        factualAccuracy === 3 ? "You stated the confirmed reference facts accurately." : "No factual strength was demonstrated in this attempt.",
        acknowledgement || apology ? "You acknowledged the customer's experience." : nextStep ? "You offered a concrete next step." : concise ? "You kept your sentences concise." : "No communication strength was demonstrated in this attempt.",
      ],
      missedFacts, unsupportedClaims: [...unsupportedClaims],
      nextExercise: `Repeat ${scenario.title.toLowerCase()}: ${missedFacts.length ? `state this confirmed answer, then offer a next step: ${missedFacts[0]}` : "acknowledge the concern, give the confirmed answer, and explain the next step."}${personalNote ? ` Coaching reminder: ${personalNote.text.trim()}` : ""}`,
      transcript: transcript.map((turn) => ({ ...turn })), sourceProvenance: Object.freeze({ ...this.provenance }),
    };
  }
}
