import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPracticeData, loadCompletedPractice, saveCompletedPractice, COMPLETED_PRACTICE_KEY } from "./local-practice-store";
import { CURRENT_PRACTICE_SESSION_KEY, readCurrentPracticeSession } from "../domain/practice-session";
import { DeterministicEvaluator } from "../evaluation/deterministic-evaluator";
import { context, turn } from "../evaluation/test-fixtures";

export const completed = async () => ({ context, report: await new DeterministicEvaluator(context.sourceProvenance).evaluate({ ...context, transcript: [turn(context.facts[0].answer)] }) });
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe("local practice storage", () => {
  it("versions and restores the completed context and report", async () => {
    const value = await completed();
    expect(COMPLETED_PRACTICE_KEY).toMatch(/v1/);
    expect(saveCompletedPractice(value)).toBe(true);
    expect(loadCompletedPractice()).toEqual(value);
  });
  it.each(["{", "null", "{}", '{"report":{"scores":null}}'])("clears invalid completed data: %s", (value) => {
    localStorage.setItem(COMPLETED_PRACTICE_KEY, value);
    expect(loadCompletedPractice()).toBeUndefined();
    expect(localStorage.getItem(COMPLETED_PRACTICE_KEY)).toBeNull();
  });
  it("rejects mismatched report provenance and malformed nested data", async () => {
    const value = await completed();
    value.report.sourceProvenance = { contentHash: "different" };
    expect(saveCompletedPractice(value)).toBe(false);
    localStorage.setItem(COMPLETED_PRACTICE_KEY, JSON.stringify(value));
    expect(loadCompletedPractice()).toBeUndefined();
  });
  it.each(["{", "null", "{}", '{"source":null}'])("clears invalid active setup without throwing: %s", (value) => {
    localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, value);
    expect(readCurrentPracticeSession()).toBeUndefined();
    expect(localStorage.getItem(CURRENT_PRACTICE_SESSION_KEY)).toBeNull();
  });
  it("clears all practice data while preserving unrelated site data", async () => {
    saveCompletedPractice(await completed());
    localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, JSON.stringify(context));
    localStorage.setItem("unrelated", "keep");
    expect(clearPracticeData()).toBe(true);
    expect(loadCompletedPractice()).toBeUndefined();
    expect(readCurrentPracticeSession()).toBeUndefined();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
  it("handles unavailable storage without crashing or claiming success", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(saveCompletedPractice(await completed())).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    expect(loadCompletedPractice()).toBeUndefined();
    expect(readCurrentPracticeSession()).toBeUndefined();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("denied"); });
    expect(clearPracticeData()).toBe(false);
  });
});
