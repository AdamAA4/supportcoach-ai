"use client";

import React, { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { SourcePreview } from "./source-preview";
import { normalizePracticeContext, validatePracticeContext, type FieldErrors } from "../domain/validation";
import { type ExperienceNote } from "../domain/reference-source";
import type { ExperienceNoteFormat } from "../domain/practice-pack";
import { deriveScenarios } from "../domain/derived-scenarios";
import { saveCurrentPracticeSession } from "../domain/practice-session";
import { ScenarioPicker } from "./scenario-picker";
import { AlertIcon, ArrowRightIcon, btnPrimary, btnSecondary, CheckIcon, fieldLabel, inputBase } from "./ui";

type SourceKind = "pasted-text" | "public-https-link";
type ImportedSource = { canonicalUrl: string; extractedText: string; contentHash: string };

const channelTile =
  "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-muted transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-soft peer-hover:text-ink-soft peer-focus-visible:ring-2 peer-focus-visible:ring-accent";

export function SourceSetupForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [sourceKind, setSourceKind] = useState<SourceKind>("pasted-text");
  const [sourceValue, setSourceValue] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [importedSource, setImportedSource] = useState<ImportedSource>();
  const [importing, setImporting] = useState(false);
  const [scenarioId, setScenarioId] = useState<string>("late-delivery");
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
      : confirmed && importedSource
        ? { kind: "public-https-link", url: importedSource.canonicalUrl, confirmation: "confirmed", snapshot: { extractedText: importedSource.extractedText, contentHash: importedSource.contentHash } }
        : { kind: "public-https-link", url: sourceValue, confirmation: "pending" },
    sourceLabel: companyName,
    notes: notes.trim() ? [{ id: "session-note", text: notes, format: noteFormat, kind: noteKind }] : [],
    scenarioId,
  }), [companyName, confirmed, importedSource, noteFormat, noteKind, notes, scenarioId, sourceKind, sourceValue]);

  // Practice drills suggested by the confirmed content itself; when the
  // source changes and the selected drill no longer resolves, fall back to
  // the first suggestion (or the built-in default).
  const derived = useMemo(() => deriveScenarios(context.facts), [context.facts]);
  const validScenarioIds = useMemo(
    () => [...derived.map((scenario) => scenario.id), "late-delivery", "refund-eligibility"],
    [derived],
  );
  useEffect(() => {
    if (!validScenarioIds.includes(scenarioId)) setScenarioId(validScenarioIds[0]);
  }, [validScenarioIds, scenarioId]);

  const invalidateSetup = () => {
    setConfirmed(false);
    setReady(false);
  };

  const updateSource = (value: string) => {
    setSourceValue(value);
    setPreviewText("");
    setImportedSource(undefined);
    invalidateSetup();
  };

  const importPublicSource = async () => {
    invalidateSetup();
    setErrors((current) => ({ ...current, source: undefined }));
    setImporting(true);
    try {
      const response = await fetch("/api/reference-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: sourceValue }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object" ||
        typeof (payload as ImportedSource).canonicalUrl !== "string" ||
        typeof (payload as ImportedSource).extractedText !== "string" ||
        typeof (payload as ImportedSource).contentHash !== "string") {
        const message = (payload as { error?: { message?: unknown } })?.error?.message;
        throw new Error(typeof message === "string" ? message : "The public source could not be imported.");
      }
      const imported = payload as ImportedSource;
      setSourceValue(imported.canonicalUrl);
      setPreviewText(imported.extractedText);
      setImportedSource(imported);
    } catch (error) {
      setPreviewText("");
      setImportedSource(undefined);
      setErrors((current) => ({ ...current, source: [error instanceof Error ? error.message : "The public source could not be imported."] }));
    } finally {
      setImporting(false);
    }
  };

  const readNoteFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setNoteFileSizeBytes(file?.size);
    invalidateSetup();
    if (!file || file.size > 200 * 1024) return;
    setNoteFormat(file.name.toLowerCase().endsWith(".md") ? "markdown" : "plain-text");
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      invalidateSetup();
      setNotes(typeof reader.result === "string" ? reader.result : "");
    });
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
    saveCurrentPracticeSession(context);
    router.push("/call");
  };

  const fieldError = (field: keyof FieldErrors) => errors[field]?.map((error) => (
    <p key={error} className="mt-2 flex items-start gap-1.5 text-sm text-danger-ink">
      <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
      {error}
    </p>
  ));

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <label className="block">
        <span className={fieldLabel}>Company name</span>
        <input value={companyName} onChange={(event) => { setCompanyName(event.target.value); invalidateSetup(); }} className={`${inputBase} mt-2`} />
        {fieldError("companyName")}
      </label>
      <fieldset className="space-y-3">
        <legend className={fieldLabel}>FAQ or policy source</legend>
        <div className="inline-grid w-full grid-cols-2 gap-1 rounded-full bg-shell p-1 sm:w-auto">
          <label>
            <input type="radio" className="peer sr-only" checked={sourceKind === "pasted-text"} onChange={() => { setSourceKind("pasted-text"); invalidateSetup(); }} />
            <span className={channelTile}>Paste text</span>
          </label>
          <label>
            <input type="radio" className="peer sr-only" checked={sourceKind === "public-https-link"} onChange={() => { setSourceKind("public-https-link"); invalidateSetup(); }} />
            <span className={channelTile}>Public HTTPS link</span>
          </label>
        </div>
        {sourceKind === "pasted-text" ? (
          <textarea value={sourceValue} onChange={(event) => updateSource(event.target.value)} rows={7} className={`${inputBase} leading-relaxed`} aria-label="FAQ or policy text" />
        ) : (
          <>
            <input value={sourceValue} onChange={(event) => updateSource(event.target.value)} placeholder="https://company.example/faq" type="url" inputMode="url" className={inputBase} aria-label="FAQ or policy URL" />
            <button type="button" onClick={() => void importPublicSource()} disabled={!sourceValue.trim() || importing} className={`${btnSecondary} mt-3`}>{importing ? "Importing source…" : "Import source"}</button>
          </>
        )}
        {fieldError("source")}
      </fieldset>
      <SourcePreview sourceText={sourceText} confirmed={confirmed} canConfirm={sourceKind === "pasted-text" || Boolean(importedSource)} onConfirm={() => setConfirmed(true)} />
      <ScenarioPicker facts={context.facts} derived={derived} value={scenarioId} onChange={(value) => { setScenarioId(value); invalidateSetup(); }} />
      {fieldError("scenario")}
      <fieldset className="space-y-3">
        <legend className={fieldLabel}>Optional experience notes</legend>
        <input
          type="file"
          accept="text/plain,text/markdown,.txt,.md"
          onChange={readNoteFile}
          className="block w-full text-sm text-ink-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-transparent file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-ink transition-colors duration-150 hover:file:border-line-strong"
        />
        <textarea value={notes} onChange={(event) => { setNotes(event.target.value); invalidateSetup(); }} rows={3} className={`${inputBase} leading-relaxed`} placeholder="Paste a coaching note" />
        <div className="flex flex-wrap gap-3">
          <select value={noteKind} onChange={(event) => { setNoteKind(event.target.value as ExperienceNote["kind"]); invalidateSetup(); }} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink transition-colors duration-200 hover:border-line-strong focus:border-accent focus:outline-none">
            <option value="personal-coaching-note">Personal coaching note</option>
            <option value="approved-practice-advice">Approved practice advice</option>
          </select>
          <select value={noteFormat} onChange={(event) => { setNoteFormat(event.target.value as ExperienceNoteFormat); invalidateSetup(); }} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink transition-colors duration-200 hover:border-line-strong focus:border-accent focus:outline-none" aria-label="Experience note format">
            <option value="plain-text">Plain text</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>
        {fieldError("notes")}
      </fieldset>
      {fieldError("facts")}
      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button type="submit" disabled={!confirmed} className={btnPrimary}>
          Start practice call
          <span className="flex size-6 items-center justify-center rounded-full bg-white/25">
            <ArrowRightIcon className="size-3.5" />
          </span>
        </button>
        {ready && (
          <p role="status" className="flex items-center gap-2 text-sm font-semibold text-ok-ink">
            <CheckIcon className="size-4 shrink-0" />
            Source confirmed. This session is ready for the trainee to answer the simulated customer by voice.
          </p>
        )}
      </div>
    </form>
  );
}
