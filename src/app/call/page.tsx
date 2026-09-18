"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CallConsole } from "../../components/call-console";
import { readCurrentPracticeSession } from "../../domain/practice-session";
import { validatePracticeContext, type PracticeContext } from "../../domain/validation";
import type { TranscriptTurn } from "../../domain/transcript";
import { equalData, isCoachingReport } from "../../evaluation/validation";
import { saveCompletedPractice } from "../../storage/local-practice-store";
import { btnPrimary, displayTitle } from "../../components/ui";

export default function CallPage() {
  const router = useRouter();
  const [context, setContext] = useState<PracticeContext>();
  const [ready, setReady] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [reportError, setReportError] = useState("");
  const [canRetryReport, setCanRetryReport] = useState(false);
  const completedTurns = useRef<TranscriptTurn[] | undefined>(undefined);
  const activeRequest = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const stored = readCurrentPracticeSession();
    if (stored && validatePracticeContext({ companyName: stored.sourceLabel, context: stored }).ok) setContext(stored);
    setReady(true);
    return () => activeRequest.current?.abort();
  }, []);

  const evaluate = async (transcript: TranscriptTurn[]) => {
    if (!context || activeRequest.current) return;
    if (!transcript.some((turn) => turn.speaker === "trainee")) {
      // An empty call is not a scored call: evaluation would return all-zero
      // scores for a transcript with no trainee response.
      setReportError("This call ended before you spoke, so there is nothing to score. Start a new practice call to try again.");
      setCanRetryReport(false);
      return;
    }
    completedTurns.current = transcript;
    const controller = new AbortController();
    activeRequest.current = controller;
    setEvaluating(true); setReportError("");
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, sourceContentHash: context.sourceContentHash, facts: context.facts, transcript }), signal: controller.signal });
      const report: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !isCoachingReport(report) || !equalData(report.transcript, transcript) || !equalData(report.sourceProvenance, context.sourceProvenance) || report.scenarioId !== context.scenario.id) {
        setReportError("The coaching report could not be generated. Your final transcript is still here; try again."); setCanRetryReport(true); return;
      }
      if (!saveCompletedPractice({ context, report })) {
        setReportError("The report could not be saved. Check browser storage space and permissions, then retry."); setCanRetryReport(true); return;
      }
      router.push("/report");
    } catch {
      setReportError("The coaching report could not be generated. Check your connection and try again."); setCanRetryReport(true);
    } finally {
      clearTimeout(timeout);
      activeRequest.current = undefined;
      setEvaluating(false);
    }
  };

  if (!ready)
    return (
      <main className="grid min-h-dvh place-items-center px-5">
        <p role="status" className="flex items-center gap-2.5 text-sm font-semibold text-ink-soft">
          <span aria-hidden="true" className="rec-pulse inline-block size-2.5 rounded-full bg-warn" />
          Loading practice session…
        </p>
      </main>
    );
  if (!context)
    return (
      <main className="mx-auto grid w-full max-w-2xl place-items-center px-5 py-16 sm:py-24">
        <div className="settle-in w-full rounded-2xl bg-shell p-1.5 shadow-card">
          <div className="rounded-xl bg-panel p-6 sm:p-8">
            <h1 className={`${displayTitle} text-3xl leading-[1.15] sm:text-4xl`}>Confirm a source before starting</h1>
            <p className="mt-5 leading-relaxed text-ink-soft">
              This call needs the current session&apos;s confirmed FAQ or policy snapshot and notes. Set up a new
              practice session to continue.
            </p>
            <Link href="/setup" className={`${btnPrimary} mt-7`}>Go to source setup</Link>
          </div>
        </div>
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-12">
      {evaluating && (
        <p role="status" className="settle-in mb-4 flex items-center gap-2.5 rounded-lg border border-line bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-ink">
          <span aria-hidden="true" className="rec-pulse inline-block size-2.5 rounded-full bg-warn" />
          Preparing your coaching report…
        </p>
      )}
      {reportError && (
        <div role="alert" className="mb-4 rounded-lg border border-danger-ink/20 bg-danger px-4 py-3 text-sm text-danger-ink">
          {reportError}
          {canRetryReport && (
            <button
              type="button"
              onClick={() => { if (completedTurns.current) void evaluate(completedTurns.current); }}
              className="ml-3 font-semibold underline underline-offset-2 transition-opacity duration-200 hover:opacity-80"
            >
              Retry report
            </button>
          )}
        </div>
      )}
      <CallConsole context={context} onCallEnded={(transcript) => void evaluate(transcript)} />
    </main>
  );
}
