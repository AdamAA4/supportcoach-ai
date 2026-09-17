"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CoachingReport } from "../../components/coaching-report";
import { clearPracticeData, loadCompletedPractice, type CompletedPractice } from "../../storage/local-practice-store";
import { btnDanger, btnPrimary, displayTitle } from "../../components/ui";

export default function ReportPage() {
  const [practice, setPractice] = useState<CompletedPractice>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setPractice(loadCompletedPractice()); setReady(true); }, []);
  const clear = () => {
    if (!clearPracticeData()) { setError("Practice data could not be fully cleared. Check browser storage permissions and try again."); return; }
    setPractice(undefined); setError("");
  };
  if (!ready)
    return (
      <main className="grid min-h-dvh place-items-center px-5">
        <p role="status" className="flex items-center gap-2.5 text-sm font-semibold text-ink-soft">
          <span aria-hidden="true" className="rec-pulse inline-block size-2.5 rounded-full bg-warn" />
          Loading coaching report…
        </p>
      </main>
    );
  return (
    <>
      {error && (
        <div className="mx-auto w-full max-w-6xl px-5 pt-8">
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger-ink">{error}</p>
        </div>
      )}
      {practice ? (
        <CoachingReport report={practice.report} onClear={clear} />
      ) : (
        <main className="mx-auto grid w-full max-w-2xl place-items-center px-5 py-16 sm:py-24">
          <div className="settle-in w-full rounded-2xl bg-shell p-1.5 shadow-card">
            <div className="rounded-xl bg-panel p-6 sm:p-8">
              <h1 className={`${displayTitle} text-3xl leading-[1.15] sm:text-4xl`}>No saved coaching report</h1>
              <p className="mt-5 leading-relaxed text-ink-soft">
                Complete a practice call to get feedback. Cleared or invalid practice data cannot be restored.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/setup" className={btnPrimary}>Practice again</Link>
                <button type="button" onClick={clear} className={btnDanger}>Clear practice data</button>
              </div>
            </div>
          </div>
        </main>
      )}
    </>
  );
}
