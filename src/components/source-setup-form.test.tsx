import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSourceContentHash } from "../domain/reference-source";
import { SourceSetupForm } from "./source-setup-form";

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
});
