import React from "react";
import { CheckIcon } from "./ui";

type SourcePreviewProps = {
  sourceText: string;
  confirmed: boolean;
  canConfirm?: boolean;
  onConfirm: () => void;
};

export function SourcePreview({ sourceText, confirmed, canConfirm = true, onConfirm }: SourcePreviewProps) {
  return (
    <section aria-labelledby="source-preview-heading" className="rounded-2xl border border-tape-line bg-tape p-4 text-tape-ink sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="source-preview-heading" className="font-display text-base font-bold tracking-tight text-tape-ink">Extracted source preview</h2>
          <p className="mt-0.5 text-sm text-tape-muted">Review this snapshot. Customer prompts and factual scoring use only this confirmed material.</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${confirmed ? "bg-ok-ink text-white" : "border-2 border-warn-ink text-warn-ink"}`}>
          {confirmed ? "Confirmed" : "Needs confirmation"}
        </span>
      </div>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-panel p-3.5 text-[13.5px] leading-relaxed text-ink-soft">{sourceText.trim() || "Add FAQ or policy text to preview it here."}</pre>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!sourceText.trim() || !canConfirm || confirmed}
        className={confirmed
          ? "mt-3 inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-full bg-tape-ink px-4 text-sm font-semibold text-canvas opacity-80"
          : "mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-tape-ink px-4 text-sm font-semibold text-canvas transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"}
      >
        {confirmed && <CheckIcon className="size-4" />}
        {confirmed ? "Source confirmed" : "Confirm this source"}
      </button>
    </section>
  );
}
