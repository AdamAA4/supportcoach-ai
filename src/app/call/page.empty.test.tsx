import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CallPage from "./page";
import { CURRENT_PRACTICE_SESSION_KEY } from "../../domain/practice-session";
import { context } from "../../evaluation/test-fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../components/call-console", () => ({
  CallConsole: ({ onCallEnded }: { onCallEnded?: (turns: unknown[]) => void }) => (
    <button onClick={() => onCallEnded?.([
      { id: "c1", speaker: "customer", text: "Where is my order?", source: "mock-transcript", startedAt: "2026-09-18T10:00:00.000Z", endedAt: "2026-09-18T10:00:00.000Z" },
    ])}>Finish test call</button>
  ),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, JSON.stringify(context));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("never scores a call where the trainee never spoke", async () => {
  render(<CallPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Finish test call" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("nothing to score");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Retry report" })).not.toBeInTheDocument();
});
