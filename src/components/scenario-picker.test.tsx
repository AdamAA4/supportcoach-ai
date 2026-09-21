import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScenarioPicker } from "./scenario-picker";

const facts = [
  { id: "delivery", question: "When will my order arrive?", answer: "Delivery takes three to five business days.", keywords: ["delivery"], source: "faq" as const },
  { id: "refund", question: "Can I request a refund?", answer: "Refunds are available for unopened items within thirty days.", keywords: ["refund"], source: "faq" as const },
];

const scenarios = [
  { id: "derived-delivery", title: "Delivery timing", customerPersona: "Customer", openingLine: "Where is my order?", goals: [], factIds: ["delivery"], difficulty: "beginner" as const },
  { id: "derived-refund", title: "Refund eligibility", customerPersona: "Customer", openingLine: "Can I get a refund?", goals: [], factIds: ["refund"], difficulty: "beginner" as const },
];

describe("ScenarioPicker", () => {
  it("adds and removes scenarios without replacing an existing selection", () => {
    const Harness = () => {
      const [selected, setSelected] = useState([scenarios[0].id]);
      return <ScenarioPicker facts={facts} derived={scenarios} value={selected} onChange={setSelected} />;
    };
    render(<Harness />);

    fireEvent.click(screen.getByLabelText("Refund eligibility"));
    expect(screen.getByLabelText("Delivery timing")).toBeChecked();
    expect(screen.getByLabelText("Refund eligibility")).toBeChecked();

    fireEvent.click(screen.getByLabelText("Delivery timing"));
    expect(screen.getByLabelText("Delivery timing")).not.toBeChecked();
    expect(screen.getByLabelText("Refund eligibility")).toBeChecked();
  });
});
