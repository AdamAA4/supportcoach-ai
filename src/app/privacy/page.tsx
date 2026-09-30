import type { Metadata } from "next";
import Link from "next/link";
import { displayTitle } from "../../components/ui";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What SupportCoach AI stores, what it sends, and how practice data is handled.",
};

const sections = [
  {
    heading: "What stays in your browser",
    body: "Your practice source, notes, final transcript, and coaching report are stored only in your browser's local storage. They are not uploaded to a database, and Clear practice data on the report screen removes them completely.",
  },
  {
    heading: "What this site does not use",
    body: "There are no accounts, no advertising cookies, and no cross-site tracking. Page-view counts come from Vercel Analytics, which is cookieless and does not identify visitors.",
  },
  {
    heading: "What is sent to the server",
    body: "When you import a public FAQ link, the server fetches that page once to extract its text and returns it to you; the fetched content is not stored or logged. When a call ends, the confirmed source facts and your final transcript are sent to the evaluation endpoint to produce your report; they are used for that response only.",
  },
  {
    heading: "Live voice practice",
    body: "In live voice mode your microphone audio is streamed to AssemblyAI's voice service using a short-lived temporary token, under AssemblyAI's own privacy terms. The permanent API key stays on the server and never reaches your browser. In mock mode, voice stays inside your browser's speech features.",
  },
  {
    heading: "AI-assisted coaching",
    body: "When AI coaching is configured, the confirmed FAQ facts and call transcript are sent to the configured provider (Google Gemini or OpenAI) to compare answer meaning with the source. Public FAQ text may also be sent for extraction when basic extraction fails. Coaching notes are not sent for semantic grading. Providers handle submitted data under their own terms; SupportCoach does not store it in an application database or log raw transcripts. If the provider is unavailable, the report uses a word-based check and labels that fallback.",
  },
  {
    heading: "Your control",
    body: "You can clear all practice data at any time from the report screen, and you can use pasted FAQ text instead of importing links if you prefer not to share a URL.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm font-bold text-accent-strong underline underline-offset-2">Home</Link>
      </div>
      <header>
        <h1 className={`${displayTitle} text-4xl leading-[1.08]`}>Privacy policy</h1>
        <p className="mt-4 text-sm text-ink-muted">Last updated 30 September 2026. Questions: mladamaadam@gmail.com</p>
      </header>
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.heading} className="rounded-2xl border border-line bg-panel p-5 shadow-card">
            <h2 className="font-display text-lg font-bold tracking-tight text-ink">{section.heading}</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
