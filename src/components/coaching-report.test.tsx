import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ReportPage from "../app/report/page";
import { saveCompletedPractice, loadCompletedPractice, COMPLETED_PRACTICE_KEY } from "../storage/local-practice-store";
import { CURRENT_PRACTICE_SESSION_KEY } from "../domain/practice-session";
import { DeterministicEvaluator } from "../evaluation/deterministic-evaluator";
import { context, turn } from "../evaluation/test-fixtures";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
it("restores four score cards, transcript, and clears persisted source, notes, and report", async () => {
  const report = await new DeterministicEvaluator(context.sourceProvenance).evaluate({ ...context, transcript: [turn(context.facts[0].answer)] });
  saveCompletedPractice({ context, report });
  localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, JSON.stringify(context));
  const view = render(<ReportPage />);
  expect(await screen.findByRole("heading", { name: "Your coaching report" })).toBeVisible();
  for (const name of ["Factual accuracy", "Empathy", "Clarity", "Resolution"]) expect(screen.getByRole("heading", { name })).toBeVisible();
  expect(screen.getByText("Full transcript").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Full transcript"));
  expect(screen.getByText(context.facts[0].answer)).toBeVisible();
  expect(screen.getByRole("link", { name: "Practice again" })).toHaveAttribute("href", "/setup");
  view.unmount();
  render(<ReportPage />);
  expect(await screen.findByRole("heading", { name: "Your coaching report" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear practice data" }));
  expect(await screen.findByText("No saved coaching report")).toBeVisible();
  expect(loadCompletedPractice()).toBeUndefined();
  expect(localStorage.getItem(CURRENT_PRACTICE_SESSION_KEY)).toBeNull();
});
it("shows an empty state for malformed storage", async () => {
  localStorage.setItem(COMPLETED_PRACTICE_KEY, "{");
  render(<ReportPage />);
  expect(await screen.findByText("No saved coaching report")).toBeVisible();
  expect(screen.getByRole("link", { name: "Practice again" })).toBeVisible();
});
