import React from "react";
import type { TranscriptTurn } from "../domain/transcript";

const speakerLabel: Record<TranscriptTurn["speaker"], string> = {
  customer: "Customer",
  trainee: "You",
  system: "System",
};

export function TranscriptPane({ turns, live = false }: { turns: TranscriptTurn[]; live?: boolean }) {
  return (
    <section aria-labelledby="transcript-heading" className="rounded-2xl bg-shell p-1.5 ring-1 ring-line">
      <div className="rounded-xl bg-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="transcript-heading" className="text-lg font-bold tracking-tight text-ink">Live transcript</h2>
          {live && (
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-danger">
              <span aria-hidden="true" className="rec-pulse inline-block size-2 rounded-full bg-danger" />
              Rec
            </span>
          )}
        </div>
        <ol className="mt-4" aria-live="polite">
          {turns.length ? turns.map((turn, index) => {
            const isCustomer = turn.speaker === "customer";
            return (
              <li key={turn.id} className={`grid grid-cols-[3.25rem_1fr] gap-x-3 py-3.5 sm:grid-cols-[4rem_1fr] sm:gap-x-4 ${index > 0 ? "border-t border-line" : ""}`}>
                <time className="pt-0.5 text-right font-mono text-[11.5px] text-ink-muted" dateTime={turn.startedAt}>
                  {new Date(turn.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </time>
                <div>
                  <p className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${isCustomer ? "text-warn" : "text-ok"}`}>{speakerLabel[turn.speaker]}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink">{turn.text}</p>
                </div>
              </li>
            );
          }) : (
            <li className="rounded-xl border border-dashed border-line px-4 py-7 text-center text-sm text-ink-muted">The call transcript will appear here.</li>
          )}
        </ol>
      </div>
    </section>
  );
}
