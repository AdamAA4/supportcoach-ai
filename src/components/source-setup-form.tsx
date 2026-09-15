"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { SourcePreview } from "./source-preview";
import { normalizePracticeContext, validatePracticeContext, type FieldErrors } from "../domain/validation";
import { createSourceContentHash, type ExperienceNote } from "../domain/reference-source";
import type { ExperienceNoteFormat } from "../domain/practice-pack";

type SourceKind = "pasted-text" | "public-https-link";

export function SourceSetupForm() {
  const [companyName, setCompanyName] = useState("");
  const [sourceKind, setSourceKind] = useState<SourceKind>("pasted-text");
  const [sourceValue, setSourceValue] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [scenarioId, setScenarioId] = useState<"late-delivery" | "refund-eligibility">("late-delivery");
  const [notes, setNotes] = useState("");
  const [noteKind, setNoteKind] = useState<ExperienceNote["kind"]>("personal-coaching-note");
  const [noteFormat, setNoteFormat] = useState<ExperienceNoteFormat>("plain-text");
  const [noteFileSizeBytes, setNoteFileSizeBytes] = useState<number>();
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [ready, setReady] = useState(false);

  const sourceText = sourceKind === "pasted-text" ? sourceValue : previewText;
  const context = useMemo(() => normalizePracticeContext({
    source: sourceKind === "pasted-text"
      ? { kind: "pasted-text", text: sourceValue, confirmation: confirmed ? "confirmed" : "pending" }
      : confirmed
        ? { kind: "public-https-link", url: sourceValue, confirmation: "confirmed", snapshot: { extractedText: previewText, contentHash: createSourceContentHash(previewText) } }
        : { kind: "public-https-link", url: sourceValue, confirmation: "pending" },
    sourceLabel: companyName,
    notes: notes.trim() ? [{ id: "session-note", text: notes, format: noteFormat, kind: noteKind }] : [],
    scenarioId,
  }), [companyName, confirmed, noteFormat, noteKind, notes, previewText, scenarioId, sourceKind, sourceValue]);

  const invalidateSetup = () => {
    setConfirmed(false);
    setReady(false);
  };

  const updateSource = (value: string) => {
    setSourceValue(value);
    invalidateSetup();
  };

  const updatePreview = (value: string) => {
    setPreviewText(value);
    invalidateSetup();
  };

  const readNoteFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setNoteFileSizeBytes(file?.size);
    if (!file || file.size > 200 * 1024) return;
    setNoteFormat(file.name.toLowerCase().endsWith(".md") ? "markdown" : "plain-text");
    const reader = new FileReader();
    reader.addEventListener("load", () => setNotes(typeof reader.result === "string" ? reader.result : ""));
    reader.readAsText(file);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validatePracticeContext({ companyName, context, noteFileSizeBytes });
    if (!result.ok) {
      setErrors(result.errors);
      setReady(false);
      return;
    }
    setErrors({});
    setReady(true);
  };

  const fieldError = (field: keyof FieldErrors) => errors[field]?.map((error) => <p key={error} className="mt-1 text-sm text-rose-700">{error}</p>);

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <label className="block font-medium text-slate-900">Company name
        <input value={companyName} onChange={(event) => { setCompanyName(event.target.value); invalidateSetup(); }} className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2" />
        {fieldError("companyName")}
      </label>
      <fieldset className="space-y-3">
        <legend className="font-medium text-slate-900">FAQ or policy source</legend>
        <div className="flex gap-4 text-sm">
          <label><input type="radio" checked={sourceKind === "pasted-text"} onChange={() => { setSourceKind("pasted-text"); invalidateSetup(); }} /> Paste text</label>
          <label><input type="radio" checked={sourceKind === "public-https-link"} onChange={() => { setSourceKind("public-https-link"); invalidateSetup(); }} /> Public HTTPS link</label>
        </div>
        {sourceKind === "pasted-text" ? (
          <textarea value={sourceValue} onChange={(event) => updateSource(event.target.value)} rows={7} className="w-full rounded-md border border-slate-300 p-3" aria-label="FAQ or policy text" />
        ) : (
          <>
            <input value={sourceValue} onChange={(event) => updateSource(event.target.value)} placeholder="https://company.example/faq" className="block w-full rounded-md border border-slate-300 px-3 py-2" aria-label="FAQ or policy URL" />
            <textarea value={previewText} onChange={(event) => updatePreview(event.target.value)} rows={7} className="mt-3 w-full rounded-md border border-slate-300 p-3" aria-label="Extracted FAQ or policy preview" placeholder="Paste the extracted source snapshot for confirmation" />
          </>
        )}
        {fieldError("source")}
      </fieldset>
      <SourcePreview sourceText={sourceText} confirmed={confirmed} onConfirm={() => setConfirmed(true)} />
      <label className="block font-medium text-slate-900">Scenario
        <select value={scenarioId} onChange={(event) => { setScenarioId(event.target.value as typeof scenarioId); invalidateSetup(); }} className="mt-2 block rounded-md border border-slate-300 px-3 py-2">
          <option value="late-delivery">Late delivery</option>
          <option value="refund-eligibility">Refund eligibility</option>
        </select>
        {fieldError("scenario")}
      </label>
      <fieldset className="space-y-3">
        <legend className="font-medium text-slate-900">Optional experience notes</legend>
        <input type="file" accept="text/plain,text/markdown,.txt,.md" onChange={readNoteFile} className="block text-sm" />
        <textarea value={notes} onChange={(event) => { setNotes(event.target.value); invalidateSetup(); }} rows={3} className="w-full rounded-md border border-slate-300 p-3" placeholder="Paste a coaching note" />
        <select value={noteKind} onChange={(event) => { setNoteKind(event.target.value as ExperienceNote["kind"]); invalidateSetup(); }} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="personal-coaching-note">Personal coaching note</option>
          <option value="approved-practice-advice">Approved practice advice</option>
        </select>
        <select value={noteFormat} onChange={(event) => { setNoteFormat(event.target.value as ExperienceNoteFormat); invalidateSetup(); }} className="rounded-md border border-slate-300 px-3 py-2" aria-label="Experience note format">
          <option value="plain-text">Plain text</option>
          <option value="markdown">Markdown</option>
        </select>
        {fieldError("notes")}
      </fieldset>
      {fieldError("facts")}
      <button type="submit" disabled={!confirmed} className="rounded-md bg-indigo-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Start practice call</button>
      {ready && <p role="status" className="text-sm font-medium text-emerald-700">Source confirmed. This session is ready for the trainee to answer the simulated customer by voice.</p>}
    </form>
  );
}
