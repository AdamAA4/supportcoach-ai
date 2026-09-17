import React from "react";
import { fieldLabel } from "./ui";

type ScenarioPickerProps = {
  value: "late-delivery" | "refund-eligibility";
  onChange: (value: "late-delivery" | "refund-eligibility") => void;
};

const scenarios = [
  { id: "late-delivery" as const, label: "Late delivery", description: "An order arrived after the promised window." },
  { id: "refund-eligibility" as const, label: "Refund eligibility", description: "A customer asks whether a purchase qualifies for a refund." },
];

const scenarioTile =
  "block h-full cursor-pointer rounded-xl border bg-shell p-4 text-left transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-line-strong peer-checked:border-amber peer-focus-visible:ring-2 peer-focus-visible:ring-ink";

export function ScenarioPicker({ value, onChange }: ScenarioPickerProps) {
  return (
    <fieldset>
      <legend className={fieldLabel}>Practice scenario</legend>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {scenarios.map((scenario) => {
          const selected = value === scenario.id;
          return (
            <label key={scenario.id}>
              <input
                type="radio"
                name="scenario"
                className="peer sr-only"
                checked={selected}
                onChange={() => onChange(scenario.id)}
              />
              <span className={`${scenarioTile} ${selected ? "border-amber" : "border-line"}`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-ink">{scenario.label}</span>
                  <span aria-hidden="true" className={`lamp inline-block size-2.5 rounded-full ${selected ? "bg-amber" : "bg-line-strong"}`} />
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-ink-muted">{scenario.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
