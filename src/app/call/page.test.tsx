import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CallPage from "./page";
import { context, turn } from "../../evaluation/test-fixtures";
import { DeterministicEvaluator } from "../../evaluation/deterministic-evaluator";
import { CURRENT_PRACTICE_SESSION_KEY } from "../../domain/practice-session";
import { loadCompletedPractice, COMPLETED_PRACTICE_KEY } from "../../storage/local-practice-store";
import type { TranscriptTurn } from "../../domain/transcript";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../components/call-console", () => ({ CallConsole: ({ onCallEnded }: { onCallEnded?: (turns: TranscriptTurn[]) => void }) => <button onClick={() => onCallEnded?.(transcript)}>Finish test call</button> }));
const transcript = [turn(context.facts[0].answer)];
beforeEach(() => { localStorage.clear(); localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, JSON.stringify(context)); push.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const report = () => new DeterministicEvaluator(context.sourceProvenance).evaluate({ ...context, transcript });

it("waits for call end and successful evaluation before saving and navigating", async () => {
  let resolve!: (response: Response) => void;
  const request = vi.fn<typeof fetch>(() => new Promise<Response>((done) => { resolve = done; }));
  vi.stubGlobal("fetch", request);
  render(<CallPage />);
  const finish = await screen.findByRole("button", { name: "Finish test call" });
  expect(localStorage.getItem(COMPLETED_PRACTICE_KEY)).toBeNull();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(finish);
  expect(localStorage.getItem(COMPLETED_PRACTICE_KEY)).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Preparing your coaching report");
  resolve(Response.json(await report()));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/report"));
  expect(loadCompletedPractice()?.report.transcript).toEqual(transcript);
  expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({ context, facts: context.facts, sourceContentHash: context.sourceContentHash, transcript });
});
it("preserves the final transcript for retry and saves nothing on evaluation failure", async () => {
  const request = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: "evaluation_failed" } }, { status: 500 })).mockResolvedValueOnce(Response.json(await report()));
  vi.stubGlobal("fetch", request);
  render(<CallPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Finish test call" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be generated");
  expect(loadCompletedPractice()).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Retry report" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/report"));
  expect(request.mock.calls[0][1].body).toBe(request.mock.calls[1][1].body);
});
it("rejects a successful response with a different transcript", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...await report(), transcript: [] })));
  render(<CallPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Finish test call" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(loadCompletedPractice()).toBeUndefined();
  expect(push).not.toHaveBeenCalled();
});
