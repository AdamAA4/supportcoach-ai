import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

import { SiteFooter } from "../components/site-footer";
import { StorageNotice } from "../components/storage-notice";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

const SITE_URL = "https://supportcoach-ai-ten.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SupportCoach AI - voice practice for support trainees",
    template: "%s · SupportCoach AI",
  },
  description: "Practice support conversations with an AI customer, grounded in your confirmed FAQ or policy, and get a four-score coaching report.",
  openGraph: {
    title: "SupportCoach AI",
    description: "Practice support conversations with an AI customer, grounded in your confirmed FAQ or policy.",
    url: SITE_URL,
    siteName: "SupportCoach AI",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SupportCoach AI - voice practice for support trainees" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SupportCoach AI",
    description: "Practice support conversations with an AI customer, grounded in your confirmed FAQ or policy.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf3f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="flex min-h-dvh flex-col bg-canvas font-sans text-ink antialiased">
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <StorageNotice />
        <Analytics />
      </body>
    </html>
  );
}
