"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CoachingReport } from "../../components/coaching-report";
import { clearPracticeData, loadCompletedPractice, type CompletedPractice } from "../../storage/local-practice-store";

export default function ReportPage() {
  const [practice, setPractice] = useState<CompletedPractice>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setPractice(loadCompletedPractice()); setReady(true); }, []);
  const clear = () => {
    if (!clearPracticeData()) { setError("Practice data could not be fully cleared. Check browser storage permissions and try again."); return; }
    setPractice(undefined); setError("");
  };
  if (!ready) return <main><p role="status">Loading coaching report…</p></main>;
  return <>{error && <p role="alert" className="mb-4 rounded-md bg-rose-50 p-3 text-rose-800">{error}</p>}{practice ? <CoachingReport report={practice.report} onClear={clear} /> : <main className="max-w-2xl"><h1 className="text-3xl font-bold text-slate-950">No saved coaching report</h1><p className="mt-3 text-slate-700">Complete a practice call to get feedback. Cleared or invalid practice data cannot be restored.</p><Link href="/setup" className="mt-5 inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white">Practice again</Link><button type="button" onClick={clear} className="ml-3 rounded-md border border-rose-300 px-4 py-2 text-rose-800">Clear practice data</button></main>}</>;
}
