import Link from "next/link";
import { btnPrimary, displayTitle } from "../components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-2xl place-items-center px-5 py-16 sm:py-24">
      <div className="settle-in w-full rounded-2xl border border-line bg-panel p-6 text-center shadow-card sm:p-10">
        <p className="font-display text-5xl font-extrabold tabular-nums text-accent">404</p>
        <h1 className={`${displayTitle} mt-4 text-3xl leading-[1.15] sm:text-4xl`}>This page is not part of the practice</h1>
        <p className="mx-auto mt-4 max-w-md leading-relaxed text-ink-soft">
          The address you followed does not exist on SupportCoach AI. Start a practice call or head back home.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/setup" className={btnPrimary}>Set up a practice call</Link>
          <Link href="/" className="text-sm font-bold text-accent-strong underline underline-offset-2">Home</Link>
        </div>
      </div>
    </main>
  );
}
