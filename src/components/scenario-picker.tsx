"use client";

import React from "react";
import type { ReferenceFact } from "../domain/reference-source";
import type { ScenarioDefinition } from "../domain/practice-pack";
import { fieldLabel } from "./ui";

type ScenarioPickerProps = {
  facts: ReferenceFact[];
  derived: ScenarioDefinition[];
  value: string;
  onChange: (value: string) => void;
};

const scenarioTile =
  "block h-full cursor-pointer rounded-xl border border-line bg-panel-2 p-4 text-left transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-accent-bright peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent";

const excerptOf = (answer: string): string => {
  const clean = answer.trim().replace(/\s+/g, " ");
  return clean.length > 96 ? `${clean.slice(0, 93).trimEnd()}...` : clean;
};

// Practice drills come from the confirmed FAQ's own sections, so they always
// match the source's domain; there are no built-in scenarios anymore.
export function ScenarioPicker({ facts, derived, value, onChange }: ScenarioPickerProps) {
  const factById = new Map(facts.map((fact) => [fact.id, fact]));
  return (
    <fieldset>
      <legend className={fieldLabel}>Practice scenario</legend>
      {derived.length > 0 ? (
        <>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-strong">From your FAQ</p>
          <div className="mt-2 grid gap-2.5">
            {derived.map((scenario) => {
              const primary = factById.get(scenario.factIds[0]);
              const checked = value === scenario.id;
              return (
                <label htmlFor={`scenario-${scenario.id}`} key={scenario.id}>
                  <input
                    type="radio"
                    id={`scenario-${scenario.id}`}
                    name="scenario"
                    className="peer sr-only"
                    checked={checked}
                    onChange={() => onChange(scenario.id)}
                  />
                  <span className={`${scenarioTile} ${checked ? "border-accent" : "border-line"}`}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-ink">{scenario.title}</span>
                      <span aria-hidden="true" className={`lamp inline-block size-2.5 shrink-0 rounded-full ${checked ? "bg-accent" : "bg-line-strong"}`} />
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-ink-muted">{primary ? excerptOf(primary.answer) : scenario.customerPersona}</span>
                    <span className="mt-2 inline-block rounded-full bg-shell px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">{scenario.factIds.length} confirmed fact{scenario.factIds.length === 1 ? "" : "s"}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-5 text-sm leading-relaxed text-ink-muted">
          No practice drills yet. Paste or import FAQ sections with a question and a full answer, and suggested
          drills appear here.
        </p>
      )}
    </fieldset>
  );
}
