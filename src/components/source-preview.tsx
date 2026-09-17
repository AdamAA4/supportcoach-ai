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
    <section aria-labelledby="source-preview-heading" className="rounded-xl bg-tape p-4 text-tape-ink sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="source-preview-heading" className="font-bold text-tape-ink">Extracted source preview</h2>
          <p className="mt-0.5 text-sm text-tape-muted">Review this snapshot. Customer prompts and factual scoring use only this confirmed material.</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${confirmed ? "bg-[#3d6b4a] text-[#eef4e8]" : "border-2 border-[#8a5f10] text-[#6e4c0b]"}`}>
          {confirmed ? "Confirmed" : "Needs confirmation"}
        </span>
      </div>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-shell p-3.5 font-mono text-[13px] leading-relaxed text-ink-soft">{sourceText.trim() || "Add FAQ or policy text to preview it here."}</pre>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!sourceText.trim() || !canConfirm || confirmed}
        className={confirmed
          ? "mt-3 inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-tape-ink px-4 text-sm font-semibold text-tape opacity-80"
          : "mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-tape-ink px-4 text-sm font-semibold text-tape transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-black active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"}
      >
        {confirmed && <CheckIcon className="size-4" />}
        {confirmed ? "Source confirmed" : "Confirm this source"}
      </button>
    </section>
  );
}
