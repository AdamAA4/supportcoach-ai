import React from "react";
import type { PracticeContext } from "../domain/validation";
import { dataMono } from "./ui";

export function ReferencePanel({ context }: { context: PracticeContext }) {
  const canonicalLink = context.source.kind === "public-https-link" ? context.source.url : undefined;
  return (
    <aside aria-labelledby="reference-heading" className="self-start rounded-xl bg-tape p-5 text-tape-ink lg:sticky lg:top-8">
      <div className="flex items-center justify-between gap-3 border-b-2 border-tape-ink pb-3">
        <h2 id="reference-heading" className="text-lg font-bold tracking-tight">Session reference</h2>
        <span className="inline-flex shrink-0 -rotate-2 items-center rounded border-2 border-[#3d6b4a] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#3d6b4a]">
          Confirmed
        </span>
      </div>
      <dl className="mt-3 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-tape-line py-2">
          <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-tape-muted">Source</dt>
          <dd className="text-right font-semibold">{context.sourceLabel}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-tape-line py-2">
          <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-tape-muted">Snapshot</dt>
          <dd className="text-right font-semibold text-[#3d6b4a]">Confirmed for this session</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-tape-muted">Hash</dt>
          <dd className={`text-right ${dataMono} text-xs break-all`}>{context.sourceContentHash}</dd>
        </div>
        {canonicalLink && (
          <div className="border-b border-dashed border-tape-line py-2">
            <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-tape-muted">Canonical link</dt>
            <dd className="mt-1 break-all"><a className="font-semibold underline underline-offset-2 transition-opacity duration-150 hover:opacity-75" href={canonicalLink} target="_blank" rel="noreferrer">{canonicalLink}</a></dd>
          </div>
        )}
      </dl>
      <section className="mt-5" aria-labelledby="facts-heading">
        <h3 id="facts-heading" className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-tape-muted">FAQ and policy facts</h3>
        <ul className="mt-2.5 space-y-2.5 text-[13.5px] leading-relaxed">
          {context.facts.map((fact) => (
            <li key={fact.id} className="rounded-lg border border-tape-line bg-[#f6efe0] p-3">
              <p className="font-bold">{fact.question}</p>
              <p className="mt-1 text-tape-ink/85">{fact.answer}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-5" aria-labelledby="notes-heading">
        <h3 id="notes-heading" className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-tape-muted">Experience notes</h3>
        {context.notes.length ? (
          <ul className="mt-2.5 space-y-2.5 text-[13.5px] leading-relaxed">
            {context.notes.map((note) => <li key={note.id} className="rounded-lg border border-tape-line bg-[#f6efe0] p-3">{note.text}</li>)}
          </ul>
        ) : (
          <p className="mt-2 text-[13.5px] text-tape-muted">No notes were added for this session.</p>
        )}
      </section>
    </aside>
  );
}
