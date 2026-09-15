import React from "react";
type ScenarioPickerProps = {
  value: "late-delivery" | "refund-eligibility";
  onChange: (value: "late-delivery" | "refund-eligibility") => void;
};

export function ScenarioPicker({ value, onChange }: ScenarioPickerProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium text-slate-900">Practice scenario</legend>
      <label className="mr-4 inline-flex items-center gap-2"><input type="radio" name="scenario" checked={value === "late-delivery"} onChange={() => onChange("late-delivery")} /> Late delivery</label>
      <label className="inline-flex items-center gap-2"><input type="radio" name="scenario" checked={value === "refund-eligibility"} onChange={() => onChange("refund-eligibility")} /> Refund eligibility</label>
    </fieldset>
  );
}
