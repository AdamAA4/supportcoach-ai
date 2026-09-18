import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Coaching report",
  description: "Your four-score practice feedback with missed facts, unsupported claims, and a next exercise.",
  robots: { index: false },
};

export default function ReportLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
