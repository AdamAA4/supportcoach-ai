import type { PracticeContext } from "../domain/validation";
import type { CoachingReport } from "../domain/report";
import { CURRENT_PRACTICE_SESSION_KEY } from "../domain/practice-session";
import { equalData, isCoachingReport, isPracticeContext, isRecord } from "../evaluation/validation";
export const COMPLETED_PRACTICE_KEY = "supportcoach.completed-practice.v1";
export type CompletedPractice = { context: PracticeContext; report: CoachingReport };

const isCompletedPractice = (value: unknown): value is CompletedPractice =>
  isRecord(value) && isPracticeContext(value.context) && isCoachingReport(value.report) &&
  equalData(value.report.sourceProvenance, value.context.sourceProvenance) && value.report.scenarioId === value.context.scenario.id;

// Called only after call shutdown and a validated successful evaluation response.
export const saveCompletedPractice = (value: CompletedPractice): boolean => {
  if (!isCompletedPractice(value)) return false;
  try { window.localStorage.setItem(COMPLETED_PRACTICE_KEY, JSON.stringify(value)); return true; } catch { return false; }
};
export const loadCompletedPractice = (): CompletedPractice | undefined => {
  try {
    const stored = window.localStorage.getItem(COMPLETED_PRACTICE_KEY);
    if (stored === null) return undefined;
    const value: unknown = JSON.parse(stored);
    if (isCompletedPractice(value)) return value;
  } catch { /* Invalid or unavailable local storage is an empty state. */ }
  try { window.localStorage.removeItem(COMPLETED_PRACTICE_KEY); } catch { /* Storage is unavailable. */ }
  return undefined;
};
export const clearPracticeData = (): boolean => {
  let cleared = true;
  for (const key of [COMPLETED_PRACTICE_KEY, CURRENT_PRACTICE_SESSION_KEY]) {
    try { window.localStorage.removeItem(key); } catch { cleared = false; }
  }
  return cleared;
};
