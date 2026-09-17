"use client";

import React, { useState } from "react";
import type { PracticeContext } from "../domain/validation";

const PREVIEW_FACTS = 3;

export function ReferencePanel({ context }: { context: PracticeContext }) {
  const [factsExpanded, setFactsExpanded] = useState(false);
  const visibleFacts = factsExpanded ? context.facts : context.facts.slice(0, PREVIEW_FACTS);
  return (
    <aside aria-labelledby="reference-heading" className="self-start rounded-2xl border border-line bg-tape p-5 shadow-card lg:sticky lg:top-8">
      <div className="flex items-center justify-between gap-3 border-b-2 border-tape-ink pb-3">
        <h2 id="reference-heading" className="font-display text-lg font-bold tracking-tight text-tape-ink">Session reference</h2>
        <span className="inline-flex shrink-0 -rotate-2 items-center rounded border-2 border-ok px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ok-ink">
          Confirmed
        </span>
      </div>
      <dl className="mt-3 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-tape-line py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tape-muted">Source</dt>
          <dd className="text-right font-semibold text-tape-ink">{context.sourceLabel}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-tape-line py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tape-muted">Snapshot</dt>
          <dd className="text-right font-semibold text-ok-ink">Confirmed for this session</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tape-muted">Hash</dt>
          <dd className="mt-0.5 text-right text-xs break-all tabular-nums text-tape-ink">{context.sourceContentHash}</dd>
        </div>
        {canonicalLinkOf(context) && (
          <div className="border-b border-dashed border-tape-line py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tape-muted">Canonical link</dt>
            <dd className="mt-1 break-all"><a className="font-semibold text-accent-strong underline underline-offset-2 transition-opacity duration-200 hover:opacity-75" href={canonicalLinkOf(context)} target="_blank" rel="noreferrer">{canonicalLinkOf(context)}</a></dd>
          </div>
        )}
      </dl>
      <section className="mt-5" aria-labelledby="facts-heading">
        <h3 id="facts-heading" className="text-[11px] font-bold uppercase tracking-[0.14em] text-tape-muted">
          FAQ and policy facts ({context.facts.length})
        </h3>
        <ul className="mt-2.5 space-y-2.5 text-[13.5px] leading-relaxed">
          {(factsExpanded ? context.facts : visibleFacts).map((fact) => (
            <li key={fact.id} className="rounded-xl border border-line bg-panel p-3">
              <p className="font-bold text-tape-ink">{fact.question}</p>
              <p className="mt-1 text-tape-ink/85">{fact.answer}</p>
            </li>
          ))}
        </ul>
        {context.facts.length > PREVIEW_FACTS && (
          <button
            type="button"
            onClick={() => setFactsExpanded(!factsExpanded)}
            aria-expanded={factsExpanded}
            className="mt-3 text-sm font-bold text-accent-strong underline underline-offset-2 transition-opacity duration-200 hover:opacity-75"
          >
            {factsExpanded ? "Show fewer facts" : `Show all ${context.facts.length} facts`}
          </button>
        )}
      </section>
      <section className="mt-5" aria-labelledby="notes-heading">
        <h3 id="notes-heading" className="text-[11px] font-bold uppercase tracking-[0.14em] text-tape-muted">Experience notes</h3>
        {context.notes.length ? (
          <ul className="mt-2.5 space-y-2.5 text-[13.5px] leading-relaxed">
            {context.notes.map((note) => <li key={note.id} className="rounded-xl border border-line bg-panel p-3 text-tape-ink">{note.text}</li>)}
          </ul>
        ) : (
          <p className="mt-2 text-[13.5px] text-tape-muted">No notes were added for this session.</p>
        )}
      </section>
    </aside>
  );
}

function canonicalLinkOf(context: PracticeContext) {
  return context.source.kind === "public-https-link" ? context.source.url : undefined;
}
