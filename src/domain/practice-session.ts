import type { PracticeContext } from "./validation";
import { isPracticeContext } from "../evaluation/validation";

export const CURRENT_PRACTICE_SESSION_KEY = "supportcoach.current-practice-session";

export const saveCurrentPracticeSession = (context: PracticeContext): void => {
  window.localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, JSON.stringify(context));
};

export const readCurrentPracticeSession = (): PracticeContext | undefined => {
  try {
    const stored = window.localStorage.getItem(CURRENT_PRACTICE_SESSION_KEY);
    if (stored === null) return undefined;
    const value: unknown = JSON.parse(stored);
    if (isPracticeContext(value)) return value;
  } catch { /* Invalid or unavailable local storage is an empty setup. */ }
  try { window.localStorage.removeItem(CURRENT_PRACTICE_SESSION_KEY); } catch { /* Storage is unavailable. */ }
  return undefined;
};
