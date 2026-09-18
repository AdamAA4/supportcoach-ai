import type { PracticeContext } from "../domain/validation";
import { normalizePracticeContext, validatePracticeContext } from "../domain/validation";
import type { TranscriptTurn } from "../domain/transcript";
import type { CoachingReport } from "../domain/report";

export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
export const equalData = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => equalData(item, b[index]));
  if (isRecord(a) && isRecord(b)) return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => Object.hasOwn(b, key) && equalData(a[key], b[key]));
  return false;
};

export const isPracticeContext = (value: unknown): value is PracticeContext => {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.scenario) || !text(value.sourceLabel) || !Array.isArray(value.notes)) return false;
  const source = value.source;
  if (source.confirmation !== "confirmed") return false;
  if (source.kind === "pasted-text") {
    if (!text(source.text) || source.text.length > 200 * 1024) return false;
  } else if (source.kind === "public-https-link") {
    if (!text(source.url) || !isRecord(source.snapshot) || !text(source.snapshot.extractedText) || source.snapshot.extractedText.length > 200 * 1024 || !text(source.snapshot.contentHash)) return false;
    try { if (new URL(source.url).protocol !== "https:") return false; } catch { return false; }
  } else return false;
  if (value.scenario.id !== "late-delivery" && value.scenario.id !== "refund-eligibility") return false;
  if (value.notes.length > 100 || !value.notes.every((note) => isRecord(note) && text(note.id) && text(note.text) && note.text.length <= 200 * 1024 && (note.format === "plain-text" || note.format === "markdown") && (note.kind === "personal-coaching-note" || note.kind === "approved-practice-advice"))) return false;
  const candidate = value as unknown as PracticeContext;
  const normalized = normalizePracticeContext({ source: candidate.source, sourceLabel: candidate.sourceLabel, notes: candidate.notes, scenarioId: value.scenario.id });
  return equalData(value, normalized) && validatePracticeContext({ companyName: candidate.sourceLabel, context: normalized }).ok;
};

export const isTranscript = (value: unknown): value is TranscriptTurn[] => Array.isArray(value) && value.length <= 200 && value.every((turn) =>
  isRecord(turn) && text(turn.id) && text(turn.text) && text(turn.speaker) && ["customer", "trainee", "system"].includes(turn.speaker) && text(turn.source) && ["live-transcript", "mock-transcript", "typed-fallback"].includes(turn.source) && text(turn.startedAt) && Number.isFinite(Date.parse(turn.startedAt)) && text(turn.endedAt) && Number.isFinite(Date.parse(turn.endedAt)) && Date.parse(turn.startedAt) <= Date.parse(turn.endedAt),
) && value.reduce((length, turn) => length + turn.text.length, 0) <= 20000;

export const isCoachingReport = (value: unknown): value is CoachingReport => {
  if (!isRecord(value) || !isRecord(value.scores) || !isRecord(value.sourceProvenance)) return false;
  if (value.practice !== undefined) {
    const practice = value.practice;
    if (!isRecord(practice) || typeof practice.openingLine !== "string" || typeof practice.focus !== "string" || typeof practice.needsConfirmation !== "boolean") return false;
    if (!Array.isArray(practice.facts) || !practice.facts.every((fact) => isRecord(fact) && typeof fact.question === "string" && typeof fact.answer === "string")) return false;
    if (!Array.isArray(practice.checklist) || !practice.checklist.every((item) => typeof item === "string")) return false;
  }
  return text(value.callId) && text(value.scenarioId) && text(value.completedAt) && Number.isFinite(Date.parse(value.completedAt)) &&
    ["factualAccuracy", "empathy", "clarity", "resolution"].every((key) => Number.isInteger(value.scores && (value.scores as Record<string, unknown>)[key]) && [0, 1, 2, 3].includes((value.scores as Record<string, number>)[key])) &&
    texts(value.strengths) && value.strengths.length === 2 && texts(value.missedFacts) && texts(value.unsupportedClaims) && text(value.nextExercise) && isTranscript(value.transcript) && text(value.sourceProvenance.contentHash) &&
    (value.sourceProvenance.sourceUrl === undefined || (text(value.sourceProvenance.sourceUrl) && /^https:\/\//.test(value.sourceProvenance.sourceUrl)));
};
