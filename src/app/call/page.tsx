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

export default function CallPage() {
  const router = useRouter();
  const [context, setContext] = useState<PracticeContext>();
  const [ready, setReady] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [reportError, setReportError] = useState("");
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
        setReportError("The coaching report could not be generated. Your final transcript is still here; try again."); return;
      }
      if (!saveCompletedPractice({ context, report })) {
        setReportError("The report could not be saved. Check browser storage space and permissions, then retry."); return;
      }
      router.push("/report");
    } catch {
      setReportError("The coaching report could not be generated. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
      activeRequest.current = undefined;
      setEvaluating(false);
    }
  };

  if (!ready) return <main><p>Loading practice session…</p></main>;
  if (!context) return <main className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Practice call</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Confirm a source before starting</h1><p className="mt-3 text-slate-700">This call needs the current session&apos;s confirmed FAQ or policy snapshot and notes. Set up a new practice session to continue.</p><Link href="/setup" className="mt-5 inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white">Go to source setup</Link></main>;
  return <>{evaluating && <p role="status" className="mb-4 rounded-md bg-indigo-50 p-3 text-indigo-800">Preparing your coaching report…</p>}{reportError && <div role="alert" className="mb-4 rounded-md bg-rose-50 p-3 text-rose-800">{reportError}<button type="button" onClick={() => { if (completedTurns.current) void evaluate(completedTurns.current); }} className="ml-3 underline">Retry report</button></div>}<CallConsole context={context} onCallEnded={(transcript) => void evaluate(transcript)} /></>;
}
