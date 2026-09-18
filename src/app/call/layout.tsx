import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Practice call",
  description: "Join the voice call and answer the simulated customer from your confirmed session reference.",
  robots: { index: false },
};

export default function CallLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
