import { normalizePracticeContext } from "../domain/validation";
import type { TranscriptTurn } from "../domain/transcript";

export const context = normalizePracticeContext({
  source: { kind: "pasted-text", confirmation: "confirmed", text: "Q: When is a refund available?\nA: Refunds are available within 30 days for unopened items." },
  sourceLabel: "Example shop", scenarioId: "refund-eligibility", notes: [],
});
export const turn = (text: string, speaker: TranscriptTurn["speaker"] = "trainee"): TranscriptTurn => ({
  id: crypto.randomUUID(), speaker, text, source: "typed-fallback",
  startedAt: "2026-09-16T12:00:00.000Z", endedAt: "2026-09-16T12:00:01.000Z",
});
export const requestBody = (transcript = [turn(context.facts[0].answer)]) => ({
  context, sourceContentHash: context.sourceContentHash, facts: context.facts, transcript,
});
