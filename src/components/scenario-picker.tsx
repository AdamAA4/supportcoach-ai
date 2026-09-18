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

const builtIn = [
  { id: "late-delivery", label: "Late delivery", description: "An order arrived after the promised window." },
  { id: "refund-eligibility", label: "Refund eligibility", description: "A customer asks whether a purchase qualifies for a refund." },
];

const scenarioTile =
  "block h-full cursor-pointer rounded-xl border border-line bg-panel-2 p-4 text-left transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-accent-bright peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent";

const excerptOf = (answer: string): string => {
  const clean = answer.trim().replace(/\s+/g, " ");
  return clean.length > 96 ? `${clean.slice(0, 93).trimEnd()}...` : clean;
};

function ScenarioCard({ id, label, description, meta, checked, onSelect }: {
  id: string;
  label: string;
  description: string;
  meta?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label htmlFor={`scenario-${id}`}>
      <input
        type="radio"
        id={`scenario-${id}`}
        name="scenario"
        className="peer sr-only"
        checked={checked}
        onChange={onSelect}
      />
      <span className={`${scenarioTile} ${checked ? "border-accent" : "border-line"}`}>
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-ink">{label}</span>
          <span aria-hidden="true" className={`lamp inline-block size-2.5 shrink-0 rounded-full ${checked ? "bg-accent" : "bg-line-strong"}`} />
        </span>
        <span className="mt-1.5 block text-sm leading-relaxed text-ink-muted">{description}</span>
        {meta && <span className="mt-2 inline-block rounded-full bg-shell px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">{meta}</span>}
      </span>
    </label>
  );
}

export function ScenarioPicker({ facts, derived, value, onChange }: ScenarioPickerProps) {
  const factById = new Map(facts.map((fact) => [fact.id, fact]));
  return (
    <fieldset>
      <legend className={fieldLabel}>Practice scenario</legend>
      {derived.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-strong">From your FAQ</p>
          <div className="mt-2 grid gap-2.5">
            {derived.map((scenario) => {
              const primary = factById.get(scenario.factIds[0]);
              return (
                <ScenarioCard
                  key={scenario.id}
                  id={scenario.id}
                  label={scenario.title}
                  description={primary ? excerptOf(primary.answer) : scenario.customerPersona}
                  meta={`${scenario.factIds.length} confirmed fact${scenario.factIds.length === 1 ? "" : "s"}`}
                  checked={value === scenario.id}
                  onSelect={() => onChange(scenario.id)}
                />
              );
            })}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">Built-in drills</p>
        </>
      )}
      <div className={`mt-2 grid gap-2.5 ${derived.length > 0 ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        {builtIn.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            id={scenario.id}
            label={scenario.label}
            description={scenario.description}
            checked={value === scenario.id}
            onSelect={() => onChange(scenario.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}
