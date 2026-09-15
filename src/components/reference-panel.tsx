import React from "react";
import type { PracticeContext } from "../domain/validation";

export function ReferencePanel({ context }: { context: PracticeContext }) {
  const canonicalLink = context.source.kind === "public-https-link" ? context.source.url : undefined;
  return (
    <aside aria-labelledby="reference-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="reference-heading" className="text-lg font-semibold text-slate-950">Session reference</h2>
      <dl className="mt-3 space-y-2 text-sm text-slate-700">
        <div><dt className="font-medium text-slate-900">Source label</dt><dd>{context.sourceLabel}</dd></div>
        <div><dt className="font-medium text-slate-900">Snapshot status</dt><dd className="text-emerald-700">Confirmed for this session</dd></div>
        <div><dt className="font-medium text-slate-900">Content hash</dt><dd>{context.sourceContentHash}</dd></div>
        {canonicalLink && <div><dt className="font-medium text-slate-900">Canonical link</dt><dd><a className="text-indigo-700 underline" href={canonicalLink} target="_blank" rel="noreferrer">{canonicalLink}</a></dd></div>}
      </dl>
      <section className="mt-5" aria-labelledby="facts-heading"><h3 id="facts-heading" className="font-semibold text-slate-900">FAQ and policy facts</h3><ul className="mt-2 space-y-3 text-sm text-slate-700">{context.facts.map((fact) => <li key={fact.id}><p className="font-medium text-slate-900">{fact.question}</p><p>{fact.answer}</p></li>)}</ul></section>
      <section className="mt-5" aria-labelledby="notes-heading"><h3 id="notes-heading" className="font-semibold text-slate-900">Experience notes</h3>{context.notes.length ? <ul className="mt-2 space-y-2 text-sm text-slate-700">{context.notes.map((note) => <li key={note.id}>{note.text}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No notes were added for this session.</p>}</section>
    </aside>
  );
}
