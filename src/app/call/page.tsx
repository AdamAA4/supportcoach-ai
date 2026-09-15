"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CallConsole } from "../../components/call-console";
import { readCurrentPracticeSession } from "../../domain/practice-session";
import { validatePracticeContext, type PracticeContext } from "../../domain/validation";

export default function CallPage() {
  const [context, setContext] = useState<PracticeContext>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readCurrentPracticeSession();
    if (stored && validatePracticeContext({ companyName: stored.sourceLabel, context: stored }).ok) setContext(stored);
    setReady(true);
  }, []);

  if (!ready) return <main><p>Loading practice session…</p></main>;
  if (!context) return <main className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Practice call</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Confirm a source before starting</h1><p className="mt-3 text-slate-700">This call needs the current session&apos;s confirmed FAQ or policy snapshot and notes. Set up a new practice session to continue.</p><Link href="/setup" className="mt-5 inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white">Go to source setup</Link></main>;
  return <CallConsole context={context} />;
}
