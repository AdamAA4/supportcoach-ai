import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSourceContentHash } from "../domain/reference-source";
import { SourceSetupForm } from "./source-setup-form";
import { CURRENT_PRACTICE_SESSION_KEY } from "../domain/practice-session";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const rotationKey = (contentHash: string) => `supportcoach-suggestion-rotation-v1:${contentHash}`;
const eightFaqPairs = Array.from({ length: 8 }, (_, index) => [
  `Q: What is policy ${index + 1}?`,
  `A: Policy ${index + 1} has a complete answer for customers to practice.`,
].join("\n")).join("\n\n");

const importSource = async (contentHash: string) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    canonicalUrl: "https://example.com/faq",
    extractedText: eightFaqPairs,
    contentHash,
  }), { status: 200 })));
  render(<SourceSetupForm />);

  fireEvent.click(screen.getByLabelText("Public HTTPS link"));
  fireEvent.change(screen.getByLabelText("FAQ or policy URL"), { target: { value: "https://example.com/faq" } });
  fireEvent.click(screen.getByRole("button", { name: "Import source" }));
  await screen.findByRole("button", { name: "Confirm this source" });
};

describe("SourceSetupForm suggestion rotation", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("uses the imported public-source hash for confirmation and refresh persistence", async () => {
    const importedHash = "sha256:imported-source";
    const pendingHash = createSourceContentHash("");
    localStorage.setItem(rotationKey(importedHash), "1");
    localStorage.setItem(rotationKey(pendingHash), "27");

    await importSource(importedHash);
    fireEvent.click(screen.getByRole("button", { name: "Confirm this source" }));

    expect(localStorage.getItem(rotationKey(importedHash))).toBe("2");
    expect(localStorage.getItem(rotationKey(pendingHash))).toBe("27");

    fireEvent.click(screen.getByRole("button", { name: "Refresh suggestions" }));
    expect(localStorage.getItem(rotationKey(importedHash))).toBe("3");
  });

  it("falls back to cursor zero when the imported public-source cursor is malformed", async () => {
    const importedHash = "sha256:malformed-cursor";
    localStorage.setItem(rotationKey(importedHash), "2.5");

    await importSource(importedHash);
    fireEvent.click(screen.getByRole("button", { name: "Confirm this source" }));
    expect(localStorage.getItem(rotationKey(importedHash))).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "Refresh suggestions" }));
    expect(localStorage.getItem(rotationKey(importedHash))).toBe("1");
  });

  it("persists pasted-source rotation under its content hash", async () => {
    const pastedHash = createSourceContentHash(eightFaqPairs);
    localStorage.setItem(rotationKey(pastedHash), "4");
    render(<SourceSetupForm />);

    fireEvent.change(screen.getByLabelText("FAQ or policy text"), { target: { value: eightFaqPairs } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm this source" }));
    expect(localStorage.getItem(rotationKey(pastedHash))).toBe("5");

    fireEvent.click(screen.getByRole("button", { name: "Refresh suggestions" }));
    expect(localStorage.getItem(rotationKey(pastedHash))).toBe("6");
  });

  it.each([
    ["Speak clearly and acknowledge the concern.", "plain-text"],
    ["# Coaching notes\n- Acknowledge the concern.", "markdown"],
  ])("detects pasted note format and preserves the note in the practice session: %s", (text, format) => {
    render(<SourceSetupForm />);
    expect(screen.queryByRole("combobox", { name: "Experience note format" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Session name"), { target: { value: "Example shop" } });
    fireEvent.change(screen.getByLabelText("FAQ or policy text"), { target: { value: eightFaqPairs } });
    fireEvent.change(screen.getByLabelText("Experience notes"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm this source" }));
    fireEvent.click(screen.getByRole("button", { name: "Start practice call" }));
    const saved = JSON.parse(localStorage.getItem(CURRENT_PRACTICE_SESSION_KEY)!);
    expect(saved.notes).toEqual([expect.objectContaining({ text, format, kind: "personal-coaching-note" })]);
  });

  it("detects Markdown files and accepts pasted recovery after an oversized note file", async () => {
    render(<SourceSetupForm />);
    fireEvent.change(screen.getByLabelText("Upload experience notes"), { target: { files: [new File(["Acknowledge the concern."], "notes.md", { type: "text/markdown" })] } });
    await waitFor(() => expect(screen.getByLabelText("Experience notes")).toHaveValue("Acknowledge the concern."));
    fireEvent.change(screen.getByLabelText("Session name"), { target: { value: "Example shop" } });
    fireEvent.change(screen.getByLabelText("FAQ or policy text"), { target: { value: eightFaqPairs } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm this source" }));
    fireEvent.click(screen.getByRole("button", { name: "Start practice call" }));
    expect(JSON.parse(localStorage.getItem(CURRENT_PRACTICE_SESSION_KEY)!).notes[0].format).toBe("markdown");

    fireEvent.change(screen.getByLabelText("Upload experience notes"), { target: { files: [new File(["x".repeat(201 * 1024)], "too-large.txt")] } });
    fireEvent.change(screen.getByLabelText("Experience notes"), { target: { value: "Speak clearly." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm this source" }));
    fireEvent.click(screen.getByRole("button", { name: "Start practice call" }));
    expect(JSON.parse(localStorage.getItem(CURRENT_PRACTICE_SESSION_KEY)!).notes[0]).toEqual(expect.objectContaining({ text: "Speak clearly.", format: "plain-text" }));
  });
});
