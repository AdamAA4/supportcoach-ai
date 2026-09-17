import { SourceSetupForm } from "../../components/source-setup-form";
import { displayTitle } from "../../components/ui";

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <header className="settle-in">
        <h1 className={`${displayTitle} text-4xl leading-[1.08] sm:text-[2.75rem]`}>Set up a grounded practice call</h1>
        <p className="mt-5 max-w-xl leading-relaxed text-ink-soft">
          Add the company material for this session, confirm the extracted preview, and select a customer scenario.
          You are the voice responder; the customer is simulated from this source.
        </p>
      </header>
      <div className="settle-in mt-9 rounded-2xl bg-shell p-1.5 shadow-card">
        <div className="rounded-xl bg-panel px-5 py-6 sm:px-8 sm:py-8">
          <SourceSetupForm />
        </div>
      </div>
    </main>
  );
}
