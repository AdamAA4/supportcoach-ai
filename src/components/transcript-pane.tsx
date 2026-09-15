import React from "react";
import type { TranscriptTurn } from "../domain/transcript";

export function TranscriptPane({ turns }: { turns: TranscriptTurn[] }) {
  return <section aria-labelledby="transcript-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 id="transcript-heading" className="text-lg font-semibold text-slate-950">Live transcript</h2><ol className="mt-4 space-y-3">{turns.length ? turns.map((turn) => <li key={turn.id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm font-semibold capitalize text-slate-950">{turn.speaker} <time className="ml-2 font-normal text-slate-500">{new Date(turn.startedAt).toLocaleTimeString()}</time></p><p className="mt-1 text-slate-700">{turn.text}</p></li>) : <li className="text-sm text-slate-500">The call transcript will appear here.</li>}</ol></section>;
}
