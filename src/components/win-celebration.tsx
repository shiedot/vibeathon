"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/hooks/live";
import {
  fireBattleWin,
  fireBestCoach,
  fireGrandChampion,
  fireParticipation,
  fireRunnerUp,
  fireTopScout,
} from "@/registry/magicui/confetti";
import type { MeState } from "@/server/state";

type Celebration = NonNullable<MeState["celebration"]>;

const STORAGE_KEY = "vibeathon:celebrated";

const PRESETS: Record<Celebration["variant"], () => void> = {
  battle_win: fireBattleWin,
  grand_champion: fireGrandChampion,
  runner_up: fireRunnerUp,
  top_scout: fireTopScout,
  best_coach: fireBestCoach,
  participation: fireParticipation,
};

const VARIANT_LABEL: Record<Celebration["variant"], string> = {
  battle_win: "Battle Won",
  grand_champion: "Grand Champion",
  runner_up: "Runner-Up",
  top_scout: "Top Scout",
  best_coach: "Best Coach",
  participation: "Participation Floor",
};

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeSeen(keys: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Keep the list bounded so localStorage doesn't grow forever.
    const arr = Array.from(keys).slice(-50);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function WinCelebration() {
  const me = useMe();
  // `dismissed` starts from localStorage so a reload won't re-celebrate the
  // same win. It's only mutated on explicit user dismiss or on first-fire.
  const [dismissed, setDismissed] = useState<Set<string>>(() => readSeen());

  const celebration = me.data?.celebration ?? null;
  const active =
    celebration && !dismissed.has(celebration.key) ? celebration : null;
  const activeKey = active?.key ?? null;

  // Fire the confetti preset exactly once per key. We intentionally do NOT
  // mutate `dismissed` here — that only flips on user action — so the banner
  // stays visible after the confetti burst.
  useEffect(() => {
    if (!activeKey || !active) return;
    PRESETS[active.variant]();
    const seen = readSeen();
    if (!seen.has(activeKey)) {
      seen.add(activeKey);
      writeSeen(seen);
    }
    // `active` is derived from activeKey; depending only on activeKey is
    // correct and keeps this effect one-shot per celebration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center pointer-events-none px-4 pb-8 md:pb-0"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-xl bg-surface-container-highest/95 backdrop-blur-lg border border-primary/40 rounded-2xl shadow-[0_0_40px_rgba(69,237,207,0.35)] overflow-hidden">
        <div className="kinetic-gradient h-1 w-full" />
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-label text-[10px] uppercase tracking-[0.3em] text-primary font-bold">
                  {VARIANT_LABEL[active.variant]}
                </span>
              </div>
              <h2 className="font-headline text-3xl md:text-5xl font-black italic uppercase leading-none tracking-tighter">
                {active.name}
              </h2>
              <p className="mt-3 font-headline text-lg md:text-xl font-bold text-primary uppercase tracking-tight">
                {active.headline}
              </p>
              <p className="mt-2 text-sm text-on-surface-variant leading-snug">
                {active.subheadline}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDismissed((prev) => {
                  const next = new Set(prev);
                  next.add(active.key);
                  writeSeen(next);
                  return next;
                });
              }}
              aria-label="Dismiss"
              className="shrink-0 w-9 h-9 rounded-full bg-surface-container-high border border-outline-variant/40 flex items-center justify-center hover:border-primary/60 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
