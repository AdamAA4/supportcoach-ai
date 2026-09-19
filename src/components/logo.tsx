import React from "react";
import Link from "next/link";

// App logo: voice-bar mark in a plum tile + Fraunces wordmark.
// The mark echoes app/icon.svg; the wordmark uses the display face.

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[28%] bg-ink ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={Math.round(size * 0.66)} height={Math.round(size * 0.66)} fill="none">
        <path
          d="M20 26v12M28 21v22M36 24v16M44 28v8"
          stroke="#d4919c"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ href, compact = false }: { href?: string; compact?: boolean }) {
  const content = (
    <>
      <LogoMark size={compact ? 26 : 32} />
      <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-ink">
        SupportCoach <span className="text-accent">AI</span>
      </span>
    </>
  );
  const classes = "inline-flex items-center gap-2.5";
  if (href) {
    return (
      <Link href={href} className={classes} aria-label="SupportCoach AI home">
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}
