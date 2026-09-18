import type { Metadata } from "next";
import Link from "next/link";
import { displayTitle } from "../../components/ui";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using the SupportCoach AI practice tool.",
};

const sections = [
  {
    heading: "A practice tool, not real support",
    body: "SupportCoach AI is a training simulator. The customer you speak with is AI-simulated, and its replies are generated from the FAQ or policy text you confirm for the session. Nothing here is real customer service, legal, financial, or professional advice.",
  },
  {
    heading: "Coaching reports are heuristic",
    body: "Scores come from a deterministic, rule-based check of your words against the confirmed reference. It can miss paraphrases and subtle phrasing, so treat every report as practice feedback to interpret alongside the transcript, not as a certified assessment.",
  },
  {
    heading: "Your content",
    body: "You are responsible for the FAQ, policy, and note material you paste or import. Do not enter real customers' personal data or confidential company material you are not authorized to use for practice.",
  },
  {
    heading: "Acceptable use",
    body: "Do not attempt to overload, automate, or abuse the service or its endpoints. Import limits and protections exist to keep the tool available to everyone.",
  },
  {
    heading: "As-is service",
    body: "The service is provided as-is and may change or be withdrawn. Practice data lives in your browser, so export or note anything you want to keep.",
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm font-bold text-accent-strong underline underline-offset-2">Home</Link>
      </div>
      <header>
        <h1 className={`${displayTitle} text-4xl leading-[1.08]`}>Terms of use</h1>
        <p className="mt-4 text-sm text-ink-muted">Last updated 18 September 2026. Questions: mladamaadam@gmail.com</p>
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
