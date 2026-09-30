import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ReferencePanel } from "./reference-panel";
import { context } from "../evaluation/test-fixtures";

afterEach(cleanup);
it("keeps FAQ answers visible with one confirmation badge and a collapsed source hash", () => {
  render(<ReferencePanel context={context} />);
  expect(screen.getByText("Confirmed")).toBeVisible();
  expect(screen.queryByText("Confirmed for this session")).not.toBeInTheDocument();
  expect(screen.getByText(context.facts[0].answer)).toBeVisible();
  expect(screen.getByText(context.sourceContentHash)).not.toBeVisible();
  fireEvent.click(screen.getByText("Technical details"));
  expect(screen.getByText(context.sourceContentHash)).toBeVisible();
});
