import type { PracticeContext } from "./validation";

export const CURRENT_PRACTICE_SESSION_KEY = "supportcoach.current-practice-session";

export const saveCurrentPracticeSession = (context: PracticeContext): void => {
  window.localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, JSON.stringify(context));
};

export const readCurrentPracticeSession = (): PracticeContext | undefined => {
  const stored = window.localStorage.getItem(CURRENT_PRACTICE_SESSION_KEY);
  if (!stored) return undefined;
  try { return JSON.parse(stored) as PracticeContext; } catch { return undefined; }
};
