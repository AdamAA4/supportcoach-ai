import React from "react";

type SourcePreviewProps = {
  sourceText: string;
  confirmed: boolean;
  canConfirm?: boolean;
  onConfirm: () => void;
};

export function SourcePreview({ sourceText, confirmed, canConfirm = true, onConfirm }: SourcePreviewProps) {
  return (
    <section aria-labelledby="source-preview-heading" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="source-preview-heading" className="font-semibold text-slate-900">Extracted source preview</h2>
          <p className="text-sm text-slate-600">Review this snapshot. Customer prompts and factual scoring use only this confirmed material.</p>
        </div>
        <span className={confirmed ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"}>
          {confirmed ? "Confirmed" : "Needs confirmation"}
        </span>
      </div>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-800">{sourceText.trim() || "Add FAQ or policy text to preview it here."}</pre>
      <button type="button" onClick={onConfirm} disabled={!sourceText.trim() || !canConfirm || confirmed} className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        {confirmed ? "Source confirmed" : "Confirm this source"}
      </button>
    </section>
  );
}
