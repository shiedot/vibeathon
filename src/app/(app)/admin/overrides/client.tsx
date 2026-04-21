"use client";

import { useMemo, useState, useTransition } from "react";
import {
  adjustBankrollAction,
  adjustTeamPotAction,
  forceResolveAction,
  moveParticipantAction,
  refundBetAction,
  regenerateRoundAction,
  reverseBattleAction,
} from "../actions";

type Participant = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: "participant" | "organizer" | "judge";
  personalBankroll: number;
  currentTeamId: string | null;
};
type Team = {
  id: string;
  displayName: string | null;
  podId: number | null;
  teamPot: number;
  isActive: boolean;
  captainId: string;
};
type Battle = {
  id: string;
  roundNumber: number;
  status: string;
  teamAId: string;
  teamBId: string;
  winnerTeamId: string | null;
};
type Bet = {
  id: string;
  bettorId: string;
  battleId: string;
  stakeAmount: number;
  refunded: boolean;
};

export function OverridesClient(props: {
  participants: Participant[];
  teams: Team[];
  battles: Battle[];
  recentBets: Bet[];
}) {
  const [tab, setTab] = useState<
    "bankroll" | "team" | "battle" | "bet" | "round"
  >("bankroll");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {(
          [
            ["bankroll", "Bankroll"],
            ["team", "Team pot / move"],
            ["battle", "Battle (force / reverse)"],
            ["bet", "Bet refund"],
            ["round", "Round regen"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              "px-3 py-2 rounded-lg text-xs uppercase font-bold tracking-widest border " +
              (tab === k
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface-container-high border-outline-variant/30 text-on-surface-variant")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bankroll" && <BankrollTab participants={props.participants} />}
      {tab === "team" && (
        <TeamTab teams={props.teams} participants={props.participants} />
      )}
      {tab === "battle" && <BattleTab battles={props.battles} teams={props.teams} />}
      {tab === "bet" && (
        <BetTab bets={props.recentBets} participants={props.participants} />
      )}
      {tab === "round" && <RoundTab />}
    </div>
  );
}

function StatusMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-lg bg-surface-container-low p-3 text-sm">{msg}</div>
  );
}

function BankrollTab({ participants }: { participants: Participant[] }) {
  const [pid, setPid] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const p = participants.find((x) => x.id === pid);
  return (
    <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-3">
      <label className="block">
        <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
          Participant
        </span>
        <select
          value={pid}
          onChange={(e) => setPid(e.target.value)}
          className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
        >
          <option value="">—</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · ₿{p.personalBankroll} · {p.role}
            </option>
          ))}
        </select>
      </label>
      <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
        <label>
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Δ (₿)
          </span>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)}
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
        </label>
        <label>
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Reason
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={pending || !pid || delta === 0 || !reason.trim()}
          onClick={() => {
            start(async () => {
              const res = await adjustBankrollAction({
                participantId: pid,
                delta,
                reason,
              });
              if (!res.ok) setMsg(res.error);
              else setMsg("Adjusted. Reload page to see fresh balance.");
            });
          }}
          className="self-end px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
        >
          Apply
        </button>
      </div>
      {p && (
        <div className="text-xs text-on-surface-variant">
          Current bankroll: ₿{p.personalBankroll.toLocaleString()} · new:{" "}
          ₿{(p.personalBankroll + delta).toLocaleString()}
        </div>
      )}
      <StatusMsg msg={msg} />
    </div>
  );
}

function TeamTab({
  teams,
  participants,
}: {
  teams: Team[];
  participants: Participant[];
}) {
  const [teamId, setTeamId] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [movePid, setMovePid] = useState("");
  const [moveTeamId, setMoveTeamId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-3">
        <div className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">
          Adjust team pot
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Team
          </span>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          >
            <option value="">—</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName ?? t.id.slice(0, 8)} · pod {t.podId ?? "—"} · ₿
                {t.teamPot} · {t.isActive ? "active" : "inactive"}
              </option>
            ))}
          </select>
        </label>
        <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)}
            placeholder="delta ₿"
            className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="reason"
            className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
          <button
            type="button"
            disabled={pending || !teamId || delta === 0 || !reason.trim()}
            onClick={() => {
              start(async () => {
                const res = await adjustTeamPotAction({
                  teamId,
                  delta,
                  reason,
                });
                if (!res.ok) setMsg(res.error);
                else setMsg("Team pot adjusted.");
              });
            }}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
          >
            Apply
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-3">
        <div className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">
          Move participant to team
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <select
            value={movePid}
            onChange={(e) => setMovePid(e.target.value)}
            className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          >
            <option value="">Participant…</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={moveTeamId}
            onChange={(e) => setMoveTeamId(e.target.value)}
            className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          >
            <option value="">Target team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName ?? t.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !movePid || !moveTeamId}
            onClick={() => {
              start(async () => {
                const res = await moveParticipantAction({
                  participantId: movePid,
                  teamId: moveTeamId,
                  reason: "Admin move",
                });
                if (!res.ok) setMsg(res.error);
                else setMsg("Moved.");
              });
            }}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
          >
            Move
          </button>
        </div>
      </div>
      <StatusMsg msg={msg} />
    </div>
  );
}

function BattleTab({
  battles,
  teams,
}: {
  battles: Battle[];
  teams: Team[];
}) {
  const [battleId, setBattleId] = useState("");
  const battle = battles.find((b) => b.id === battleId);
  const [winner, setWinner] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const teamName = (id: string) =>
    teams.find((t) => t.id === id)?.displayName ?? id.slice(0, 8);
  return (
    <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-3">
      <label className="block">
        <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
          Battle
        </span>
        <select
          value={battleId}
          onChange={(e) => {
            setBattleId(e.target.value);
            setWinner("");
          }}
          className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
        >
          <option value="">—</option>
          {battles.map((b) => (
            <option key={b.id} value={b.id}>
              R{b.roundNumber} · {teamName(b.teamAId)} vs {teamName(b.teamBId)} ·{" "}
              {b.status}
              {b.winnerTeamId ? ` · winner ${teamName(b.winnerTeamId)}` : ""}
            </option>
          ))}
        </select>
      </label>
      {battle && (
        <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
          <select
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          >
            <option value="">Pick winner…</option>
            <option value={battle.teamAId}>{teamName(battle.teamAId)}</option>
            <option value={battle.teamBId}>{teamName(battle.teamBId)}</option>
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="reason"
            className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
          <button
            type="button"
            disabled={pending || !winner || !reason.trim()}
            onClick={() => {
              start(async () => {
                const res = await forceResolveAction(battleId, winner, reason);
                if (!res.ok) setMsg(res.error);
                else setMsg("Force-resolved.");
              });
            }}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
          >
            Force resolve
          </button>
        </div>
      )}
      {battle?.status === "resolved" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                "Reverse this battle? Restores teams, refunds bets, removes next-round matchups.",
              )
            )
              return;
            start(async () => {
              const res = await reverseBattleAction(battleId);
              if (!res.ok) setMsg(res.error);
              else setMsg("Reversed to voting.");
            });
          }}
          className="mt-2 px-4 py-2 rounded-lg bg-tertiary text-on-tertiary font-bold uppercase text-xs tracking-widest"
        >
          Reverse resolution
        </button>
      )}
      <StatusMsg msg={msg} />
    </div>
  );
}

function BetTab({
  bets,
  participants,
}: {
  bets: Bet[];
  participants: Participant[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nameById = useMemo(
    () => new Map(participants.map((p) => [p.id, p.name])),
    [participants],
  );
  return (
    <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-3">
      <div className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">
        Recent 50 bets
      </div>
      <div className="divide-y divide-outline-variant/10">
        {bets.map((b) => (
          <div key={b.id} className="flex items-center justify-between py-2">
            <div className="text-sm">
              <div className="font-medium">
                {nameById.get(b.bettorId) ?? b.bettorId.slice(0, 8)}
              </div>
              <div className="text-[10px] text-on-surface-variant">
                ₿{b.stakeAmount.toLocaleString()} · battle {b.battleId.slice(0, 8)} ·{" "}
                {b.refunded ? "refunded" : "active"}
              </div>
            </div>
            {!b.refunded && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Refund this bet?")) return;
                  start(async () => {
                    const res = await refundBetAction(b.id);
                    if (!res.ok) setMsg(res.error);
                    else setMsg("Refunded.");
                  });
                }}
                className="px-3 py-1 rounded bg-tertiary text-on-tertiary text-[10px] uppercase font-bold tracking-widest"
              >
                Refund
              </button>
            )}
          </div>
        ))}
      </div>
      <StatusMsg msg={msg} />
    </div>
  );
}

function RoundTab() {
  const [round, setRound] = useState(2);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-3">
      <div className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">
        Regenerate round matchups (only if no battle has started)
      </div>
      <div className="flex gap-3 items-end">
        <label>
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Round
          </span>
          <input
            type="number"
            value={round}
            min={2}
            max={6}
            onChange={(e) => setRound(parseInt(e.target.value, 10) || 2)}
            className="mt-1 w-24 bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Regenerate round ${round} matchups?`)) return;
            start(async () => {
              const res = await regenerateRoundAction(round);
              if (!res.ok) setMsg(res.error);
              else setMsg("Regenerated; auto-advancement will pick up on next resolve.");
            });
          }}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
        >
          Regenerate
        </button>
      </div>
      <StatusMsg msg={msg} />
    </div>
  );
}
