"use client";

import React from "react";
import Link from "next/link";
import type { CoachingReport as Report } from "../domain/report";
import { TranscriptPane } from "./transcript-pane";

const dimensions = [
  { key: "factualAccuracy", label: "Factual accuracy", explanation: "How many confirmed reference answers you stated with their conditions. Conflicting claims reduce this score." },
  { key: "empathy", label: "Empathy", explanation: "Acknowledging the customer's concern and offering an apology when appropriate." },
  { key: "clarity", label: "Clarity", explanation: "Using short sentences and giving direct answers." },
  { key: "resolution", label: "Resolution", explanation: "Offering a next step and explaining how to get further support." },
] as const;

function FeedbackList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-950">{title}</h2>{items.length ? <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">{items.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul> : <p className="mt-3 text-slate-700">{empty}</p>}</section>;
}

export function CoachingReport({ report, onClear }: { report: Report; onClear: () => void }) {
  return <main className="max-w-6xl space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Practice feedback</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Your coaching report</h1><p className="mt-3 text-slate-700">Scores range from 0 to 3. This rule-based practice feedback checks the words and conditions in your confirmed reference; it may miss paraphrases.</p></header>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{dimensions.map(({ key, label, explanation }) => <section key={key} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">{label}</h2><p className="mt-3 text-3xl font-bold text-indigo-700" aria-label={`${label}: ${report.scores[key]} out of 3`}>{report.scores[key]}<span className="text-base text-slate-600"> / 3</span></p><p className="mt-3 text-sm text-slate-700">{explanation}</p></section>)}</div>
    <FeedbackList title="Strengths" items={report.strengths} empty="Keep practicing." />
    <div className="grid gap-4 md:grid-cols-2"><FeedbackList title="Missed facts" items={report.missedFacts} empty="You stated all the required reference answers." /><FeedbackList title="Unsupported claims" items={report.unsupportedClaims} empty="No conflicting claims were detected by this rule-based check." /></div>
    <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="text-lg font-semibold text-slate-950">Next exercise</h2><p className="mt-3 break-words text-slate-700">{report.nextExercise}</p></section>
    <details className="rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold text-slate-950">Full transcript</summary><div className="mt-4"><TranscriptPane turns={report.transcript} /></div></details>
    <p className="break-all text-sm text-slate-600">Confirmed source: {report.sourceProvenance.sourceUrl ?? "Pasted FAQ or policy"} · {report.sourceProvenance.contentHash}</p>
    <div className="flex flex-wrap gap-3"><Link href="/setup" className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white">Practice again</Link><button type="button" onClick={onClear} className="rounded-md border border-rose-300 px-4 py-2 text-rose-800">Clear practice data</button></div>
  </main>;
}
