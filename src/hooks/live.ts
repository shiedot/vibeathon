"use client";

import useSWR from "swr";
import type { MeState, BracketNode, BattleStateDetail, Leaderboards, AuditState } from "@/server/state";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useMe() {
  return useSWR<MeState>("/api/state/me", fetcher, {
    refreshInterval: 3000,
  });
}

export function useBracket() {
  return useSWR<BracketNode[]>("/api/state/bracket", fetcher, {
    refreshInterval: 5000,
  });
}

export function useBattle(id: string | null | undefined) {
  return useSWR<BattleStateDetail>(
    id ? `/api/state/battles/${id}` : null,
    fetcher,
    { refreshInterval: 2000 },
  );
}

export function useLeaderboards() {
  return useSWR<Leaderboards>("/api/state/leaderboards", fetcher, {
    refreshInterval: 5000,
  });
}

export function useAudit() {
  return useSWR<AuditState>("/api/state/admin/audit", fetcher, {
    refreshInterval: 3000,
  });
}
