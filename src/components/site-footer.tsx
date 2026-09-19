import Link from "next/link";
import React from "react";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between">
        <Logo href="/" compact />
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link href="/setup" className="font-bold text-accent-strong underline underline-offset-2">Set up a practice call</Link>
          <Link href="/" className="text-ink-muted transition-colors duration-200 hover:text-ink">Home</Link>
          <Link href="/privacy" className="text-ink-muted transition-colors duration-200 hover:text-ink">Privacy</Link>
          <Link href="/terms" className="text-ink-muted transition-colors duration-200 hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
