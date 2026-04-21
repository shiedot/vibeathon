"use client";

import { useEffect, useState } from "react";

export function Countdown({
  target,
  label,
  tone = "primary",
}: {
  target: Date | string | null;
  label: string;
  tone?: "primary" | "tertiary";
}) {
  const t = target ? new Date(target).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!t) {
    return (
      <div className="text-xs text-on-surface-variant">{label} — not yet scheduled</div>
    );
  }

  const diff = Math.max(0, t - now);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const toneClass = tone === "tertiary" ? "text-tertiary" : "text-primary";

  return (
    <div>
      <span className="font-label text-[10px] uppercase tracking-widest text-gray-400 block mb-1">
        {label}
      </span>
      <div className={`font-headline text-3xl font-black tabular-nums ${toneClass}`}>
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}
      </div>
    </div>
  );
}
