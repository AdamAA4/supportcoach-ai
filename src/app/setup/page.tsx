import { SourceSetupForm } from "../../components/source-setup-form";

export default function SetupPage() {
  return (
    <main className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">SupportCoach AI</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Set up a grounded practice call</h1>
      <p className="mt-3 text-slate-700">Add the company material for this session, confirm the extracted preview, and select a customer scenario. You are the voice responder; the customer is simulated from this source.</p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><SourceSetupForm /></div>
    </main>
  );
}
