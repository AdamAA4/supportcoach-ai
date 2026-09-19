import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../components/logo";
import { ArrowRightIcon, btnPrimary, displayTitle } from "../components/ui";

export const metadata: Metadata = {
  title: "Practice support conversations with an AI customer",
  description: "Ground every simulated call in a confirmed FAQ or policy source, then practice your response by voice and get a four-score coaching report.",
};

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:py-10">
      <header className="flex items-center justify-between border-b border-line pb-5">
        <Logo />
        <span className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted sm:block">Practice workspace</span>
      </header>
      <main className="settle-in pb-16 pt-16 sm:pb-24 sm:pt-24">
        <h1 className={`${displayTitle} text-[2.4rem] leading-[1.05] sm:text-6xl`}>
          Practice support conversations with an AI customer
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Ground every simulated call in a confirmed FAQ or policy source, then practice your response by voice.
        </p>
        <Link href="/setup" className={`${btnPrimary} mt-9`}>
          Set up a practice call
          <ArrowRightIcon className="size-4" />
        </Link>
      </main>
    </div>
  );
}
