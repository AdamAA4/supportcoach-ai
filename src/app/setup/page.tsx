import type { Metadata } from "next";
import { SourceSetupForm } from "../../components/source-setup-form";
import { BackLink, displayTitle } from "../../components/ui";

export const metadata: Metadata = {
  title: "Set up a practice call",
  description: "Add your company FAQ or policy, confirm the extracted facts, and choose one or more customer scenarios for a voice practice call.",
};

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
      <div className="mb-8">
        <BackLink href="/" label="Home" />
      </div>
      <header className="settle-in">
        <h1 className={`${displayTitle} text-4xl leading-[1.08] sm:text-[2.75rem]`}>Set up a grounded practice call</h1>
        <p className="mt-5 max-w-xl leading-relaxed text-ink-soft">
          Add the company material for this session, confirm the extracted preview, and select one or more customer scenarios.
          You are the voice responder; the customer is simulated from this source.
        </p>
      </header>
      <div className="settle-in mt-8 rounded-2xl bg-shell p-1.5 shadow-card">
        <div className="rounded-xl bg-panel px-5 py-6 sm:px-8 sm:py-8">
          <SourceSetupForm />
        </div>
      </div>
    </main>
  );
}
