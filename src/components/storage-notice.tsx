"use client";

import React, { useEffect, useState } from "react";

const CONSENT_KEY = "supportcoach.storage-notice.v1";

// The app sets no cookies and runs no cross-site tracking; this notice
// discloses the browser-local storage the practice flow depends on.
export function StorageNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CONSENT_KEY) !== "acknowledged") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const acknowledge = () => {
    try { window.localStorage.setItem(CONSENT_KEY, "acknowledged"); } catch { /* storage unavailable; notice simply hides for this visit */ }
    setVisible(false);
  };

  return (
    <div role="region" aria-label="Storage notice" className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="settle-in mx-auto flex w-full max-w-3xl flex-col items-start gap-3 rounded-2xl border border-line bg-panel/95 p-4 shadow-card backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-ink-soft">
          This practice tool stores your session, transcript, and report in this browser only. It uses no cookies and
          no cross-site tracking.{" "}
          <a href="/privacy" className="font-semibold text-accent-strong underline underline-offset-2">Privacy policy</a>
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-accent px-4 text-sm font-bold text-accent-ink transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent-strong active:scale-[0.97]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
