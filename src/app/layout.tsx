import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupportCoach AI",
  description: "A simulated-customer practice workspace for support trainees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
