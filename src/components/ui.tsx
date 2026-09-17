import React from "react";

/* Shared visual primitives for the Maison Rose UI (ported from the cosmet project). Styling only — no behavior. */

export const displayTitle =
  "font-display font-extrabold tracking-[-0.01em] text-balance text-ink";

export const panelLabel =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted";

export const dataMono = "tabular-nums";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-ink shadow-soft transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent-strong active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-soft transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-accent-bright active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

export const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-danger/40 bg-surface px-4 text-sm font-semibold text-danger transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-danger hover:bg-danger/5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

export const inputBase =
  "block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink transition-colors duration-200 placeholder:text-ink-faint hover:border-line-strong focus:border-accent focus:outline-none";

export const fieldLabel = "block text-sm font-semibold text-ink";

export type LampTone = "ok" | "warn" | "danger" | "neutral" | "accent";

const lampTone: Record<LampTone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  accent: "bg-accent",
  neutral: "bg-line-strong",
};

export function StatusLamp({ tone = "neutral", pulse = false }: { tone?: LampTone; pulse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`lamp inline-block size-2.5 shrink-0 rounded-full ${lampTone[tone]} ${pulse ? "rec-pulse lamp-live" : ""}`}
    />
  );
}

type IconProps = React.SVGProps<SVGSVGElement>;

function Svg(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </Svg>
  );
}

export function MicOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 9.5V6a3 3 0 0 0-5.7-1.3" />
      <path d="M9 9.5V12a3 3 0 0 0 4.6 2.5" />
      <path d="M5 11a7 7 0 0 0 10.5 6" />
      <path d="M17.7 15.7A7 7 0 0 0 19 11" />
      <path d="M12 18v3" />
      <path d="M4 4l16 16" />
    </Svg>
  );
}

export function EndCallIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="9.75" width="17" height="4.5" rx="2.25" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13" />
      <path d="M12 16.5h.01" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9l7 7 7-7" />
    </Svg>
  );
}
