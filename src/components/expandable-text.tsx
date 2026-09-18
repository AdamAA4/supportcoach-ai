"use client";

import React, { useState } from "react";

const CLAMP_LENGTH = 220;

// Long fact answers stay readable: clamped with a Show more toggle.
export function ExpandableText({ text, label = "Show more", className }: { text: string; label?: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const clean = text.trim();
  const isLong = clean.length > CLAMP_LENGTH;
  const visible = isLong && !expanded
    ? `${clean.slice(0, CLAMP_LENGTH - 3).replace(/\s+\S*$/, "").trimEnd()}...`
    : clean;
  return (
    <span className={`block ${className ?? ""}`}>
      <span className="whitespace-pre-line">{visible}</span>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-1 text-[13px] font-bold text-accent-strong underline underline-offset-2 transition-opacity duration-200 hover:opacity-75"
        >
          {expanded ? "Show less" : label}
        </button>
      )}
    </span>
  );
}
