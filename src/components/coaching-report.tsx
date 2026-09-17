"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { CoachingReport as Report } from "../domain/report";
import { TranscriptPane } from "./transcript-pane";
import { BackLink, btnDanger, btnPrimary, ChevronDownIcon } from "./ui";

const EXERCISE_LIMIT = 320;

const dimensions = [
  { key: "factualAccuracy", label: "Factual accuracy", explanation: "How many confirmed reference answers you stated with their conditions. Conflicting claims reduce this score." },
  { key: "empathy", label: "Empathy", explanation: "Acknowledging the customer's concern and offering an apology when appropriate." },
  { key: "clarity", label: "Clarity", explanation: "Using short sentences and giving direct answers." },
  { key: "resolution", label: "Resolution", explanation: "Offering a next step and explaining how to get further support." },
] as const;

const scoreDelays = ["", "delay-75", "delay-150", "delay-200"];

function FeedbackList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-card">
      <h2 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
      {items.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft marker:text-ink-faint">
          {items.map((item, index) => <li key={index} className="break-words leading-relaxed pl-1">{item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 leading-relaxed text-ink-muted">{empty}</p>
      )}
    </section>
  );
}

export function CoachingReport({ report, onClear }: { report: Report; onClear: () => void }) {
  const [exerciseExpanded, setExerciseExpanded] = useState(false);
  const exerciseLong = report.nextExercise.length > EXERCISE_LIMIT;
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-12">
      <div className="mb-8">
        <BackLink href="/" label="Home" />
      </div>
      <div className="space-y-5 sm:space-y-6">
        <header className="settle-in">
          <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-balance text-ink sm:text-[2.75rem]">
            Your coaching report
          </h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">
            Scores range from 0 to 3. This rule-based practice feedback checks the words and conditions in your
            confirmed reference; it may miss paraphrases.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dimensions.map(({ key, label, explanation }, index) => (
            <section key={key} className={`settle-in rounded-2xl border border-line bg-panel p-5 shadow-card ${scoreDelays[index]}`}>
              <h2 className="text-sm font-bold text-ink">{label}</h2>
              <p className="mt-3 font-display text-4xl font-extrabold tabular-nums text-ink" aria-label={`${label}: ${report.scores[key]} out of 3`}>
                {report.scores[key]}
                <span className="font-sans text-base font-medium text-ink-muted"> / 3</span>
              </p>
              <div className="mt-3 flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((step) => (
                  <span key={step} className={`h-1.5 flex-1 rounded-full ${step < report.scores[key] ? "bg-accent" : "bg-line"}`} />
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{explanation}</p>
            </section>
          ))}
        </div>
        <FeedbackList title="Strengths" items={report.strengths} empty="Keep practicing." />
        <div className="grid gap-4 md:grid-cols-2">
          <FeedbackList title="Missed facts" items={report.missedFacts} empty="You stated all the required reference answers." />
          <FeedbackList title="Unsupported claims" items={report.unsupportedClaims} empty="No conflicting claims were detected by this rule-based check." />
        </div>
        <section className="rounded-2xl border border-warn/30 bg-warn-bg p-5">
          <h2 className="font-display text-lg font-bold tracking-tight text-warn-ink">Next exercise</h2>
          <p className="mt-3 break-words leading-relaxed text-ink-soft">
            {exerciseLong && !exerciseExpanded ? `${report.nextExercise.slice(0, EXERCISE_LIMIT).trimEnd()}...` : report.nextExercise}
          </p>
          {exerciseLong && (
            <button
              type="button"
              onClick={() => setExerciseExpanded(!exerciseExpanded)}
              className="mt-3 text-sm font-bold text-warn-ink underline underline-offset-2 transition-opacity duration-200 hover:opacity-80"
            >
              {exerciseExpanded ? "Show less" : "Show full exercise"}
            </button>
          )}
        </section>
        <details className="group rounded-2xl border border-line bg-panel p-5 shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink [&::-webkit-details-marker]:hidden">
            Full transcript
            <ChevronDownIcon className="size-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="mt-4"><TranscriptPane turns={report.transcript} /></div>
        </details>
        <p className="break-all text-sm leading-relaxed text-ink-muted">
          Confirmed source: {report.sourceProvenance.sourceUrl ?? "Pasted FAQ or policy"} · {report.sourceProvenance.contentHash}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/setup" className={btnPrimary}>Practice again</Link>
          <button type="button" onClick={onClear} className={btnDanger}>Clear practice data</button>
        </div>
      </div>
    </main>
  );
}
