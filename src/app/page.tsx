import Link from "next/link";

export default function Home() {
  return <main className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">SupportCoach AI</p><h1 className="mt-2 text-4xl font-bold text-slate-950">Practice support conversations with an AI customer</h1><p className="mt-4 text-lg text-slate-700">Ground every simulated call in a confirmed FAQ or policy source, then practice your response by voice or typed fallback.</p><Link href="/setup" className="mt-7 inline-block rounded-md bg-indigo-600 px-5 py-3 font-semibold text-white">Set up a practice call</Link></main>;
}
