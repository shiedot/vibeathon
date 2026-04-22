"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPhantomTravellersAction,
  commitPodsAction,
  previewPodsAction,
  removeLastPhantomAction,
  resetTournamentAction,
} from "../actions";

type Preview = Extract<
  Awaited<ReturnType<typeof previewPodsAction>>,
  { ok: true }
>["data"];

type RosterOption = Preview["roster"][number];

type DraftMatchup = {
  matchupNo: number; // 1..32
  podId: number; // 1..8
  teamAId: string;
  teamBId: string;
};

const DEFAULT_TZ = "Asia/Dhaka";

function getSupportedTimezones(): string[] {
  type WithSupported = {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const intl = Intl as unknown as WithSupported;
  const list = intl.supportedValuesOf?.("timeZone");
  if (list && list.length > 0) return list;
  return [
    "Asia/Dhaka",
    "Asia/Kolkata",
    "Asia/Karachi",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "UTC",
  ];
}

function wallClockInTz(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T10:05`;
}

function zonedWallClockToUtcIso(local: string, timeZone: string): string {
  const [datePart, timePart] = local.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const asIfUtc = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  const probe = new Date(asIfUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(probe);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const tzHour = get("hour") === 24 ? 0 : get("hour");
  const tzWall = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    tzHour,
    get("minute"),
    get("second"),
  );
  const offset = tzWall - asIfUtc;
  return new Date(asIfUtc - offset).toISOString();
}

function formatTzLabel(tz: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return `${tz} (${offset})`;
  } catch {
    return tz;
  }
}

export type SeedableBreakdown = {
  roster: number;
  walkIns: number;
  phantoms: number;
  organizers: number;
  judges: number;
};

export function PodsClient({
  alreadyCommitted,
  travellersRegistered,
  breakdown,
}: {
  alreadyCommitted: boolean;
  travellersRegistered: number;
  breakdown: SeedableBreakdown;
}) {
  const [timeZone, setTimeZone] = useState<string>(DEFAULT_TZ);
  const [startAt, setStartAt] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<DraftMatchup[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function bumpTravellers(delta: number) {
    if (alreadyCommitted) {
      setMsg("Reset first — roster is locked once R1 is committed.");
      return;
    }
    start(async () => {
      if (delta > 0) {
        const res = await addPhantomTravellersAction(delta);
        if (!res.ok) setErr(res.error);
        else {
          setMsg(`Added ${res.data.added} phantom traveller(s).`);
          setPreview(null);
          setDraft(null);
          router.refresh();
        }
        return;
      }
      for (let i = 0; i < Math.abs(delta); i += 1) {
        const res = await removeLastPhantomAction();
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        if (!res.data.removed) {
          setMsg("No phantom travellers left to remove.");
          break;
        }
      }
      setPreview(null);
      setDraft(null);
      router.refresh();
    });
  }

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [tzOptions, setTzOptions] = useState<string[]>([DEFAULT_TZ]);
  useEffect(() => {
    const n = new Date();
    setMounted(true);
    setNow(n);
    setTzOptions(getSupportedTimezones());
    setStartAt((prev) => (prev === "" ? wallClockInTz(n, DEFAULT_TZ) : prev));
  }, []);

  const previewUtc = useMemo(() => {
    try {
      return zonedWallClockToUtcIso(startAt, timeZone);
    } catch {
      return null;
    }
  }, [startAt, timeZone]);

  function draftFromPreview(data: Preview): DraftMatchup[] {
    return data.r1Matchups.map((m, i) => ({
      matchupNo: i + 1,
      podId: m.podId,
      teamAId: m.teamA.id,
      teamBId: m.teamB.id,
    }));
  }

  function doPreview() {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await previewPodsAction();
      if (!res.ok) setErr(res.error);
      else {
        setPreview(res.data);
        setDraft(draftFromPreview(res.data));
      }
    });
  }

  function resetDraftToAutoSeed() {
    if (preview) setDraft(draftFromPreview(preview));
  }

  function updateSlot(
    matchupNo: number,
    side: "A" | "B",
    newId: string,
  ) {
    setDraft((d) => {
      if (!d) return d;
      return d.map((row) => {
        if (row.matchupNo !== matchupNo) return row;
        return {
          ...row,
          teamAId: side === "A" ? newId : row.teamAId,
          teamBId: side === "B" ? newId : row.teamBId,
        };
      });
    });
  }

  const rosterById = useMemo(() => {
    const map = new Map<string, RosterOption>();
    if (preview) for (const r of preview.roster) map.set(r.id, r);
    return map;
  }, [preview]);

  // matchup index where a given participant is currently sitting (1-based),
  // or a list if they're in several (shouldn't happen after validation).
  const assignmentsByPid = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!draft) return map;
    for (const row of draft) {
      for (const pid of [row.teamAId, row.teamBId]) {
        const arr = map.get(pid) ?? [];
        arr.push(row.matchupNo);
        map.set(pid, arr);
      }
    }
    return map;
  }, [draft]);

  const unassigned = useMemo(() => {
    if (!preview || !draft) return [] as RosterOption[];
    const used = new Set<string>();
    for (const row of draft) {
      used.add(row.teamAId);
      used.add(row.teamBId);
    }
    return preview.roster.filter((r) => !used.has(r.id));
  }, [preview, draft]);

  const duplicates = useMemo(() => {
    const out: { pid: string; name: string; matchups: number[] }[] = [];
    for (const [pid, arr] of assignmentsByPid) {
      if (arr.length > 1) {
        const p = rosterById.get(pid);
        out.push({
          pid,
          name: p?.name ?? pid,
          matchups: arr.slice().sort((a, b) => a - b),
        });
      }
    }
    return out;
  }, [assignmentsByPid, rosterById]);

  const hasErrors = duplicates.length > 0 || unassigned.length > 0;

  function doCommit() {
    if (alreadyCommitted) {
      setMsg("Reset first.");
      return;
    }
    if (!draft) {
      setErr("Generate a seed first.");
      return;
    }
    if (hasErrors) {
      setErr(
        duplicates.length > 0
          ? `${duplicates.length} participant(s) are in multiple matchups.`
          : `${unassigned.length} participant(s) haven't been placed in a matchup.`,
      );
      return;
    }
    start(async () => {
      setErr(null);
      const iso = zonedWallClockToUtcIso(startAt, timeZone);
      const res = await commitPodsAction(
        draft.map((m) => ({
          podId: m.podId,
          teamAParticipantId: m.teamAId,
          teamBParticipantId: m.teamBId,
        })),
        iso,
      );
      if (!res.ok) setErr(res.error);
      else {
        setMsg(
          `Committed: ${res.data.teamsCreated} teams, ${res.data.battlesCreated} battles.`,
        );
        router.refresh();
      }
    });
  }

  function doReset() {
    if (
      !confirm(
        "Wipe teams, battles, bets, ledger? Participants stay. This cannot be undone.",
      )
    )
      return;
    start(async () => {
      const res = await resetTournamentAction();
      if (!res.ok) setErr(res.error);
      else {
        setPreview(null);
        setDraft(null);
        setMsg("Tournament state wiped.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[1fr_1fr_1.2fr_auto] gap-4 items-end">
        <div className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Seedable travellers
          </span>
          <div className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-1 py-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => bumpTravellers(-1)}
              disabled={pending || alreadyCommitted || travellersRegistered === 0}
              aria-label="Remove last phantom traveller"
              className="w-9 h-9 rounded-md bg-surface-container-highest hover:bg-surface-container-high disabled:opacity-40 flex items-center justify-center text-xl font-black leading-none"
            >
              −
            </button>
            <span className="font-mono text-2xl font-black tabular-nums">
              {travellersRegistered}
            </span>
            <button
              type="button"
              onClick={() => bumpTravellers(1)}
              disabled={pending || alreadyCommitted}
              aria-label="Add a phantom traveller"
              className="w-9 h-9 rounded-md bg-surface-container-highest hover:bg-surface-container-high disabled:opacity-40 flex items-center justify-center text-xl font-black leading-none"
            >
              +
            </button>
          </div>
          <SeedableBreakdownLine breakdown={breakdown} />
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Round 1 scheduled start
          </span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Timezone
          </span>
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          >
            {mounted && now ? (
              tzOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {formatTzLabel(tz, now)}
                </option>
              ))
            ) : (
              <option key={DEFAULT_TZ} value={DEFAULT_TZ}>
                {DEFAULT_TZ}
              </option>
            )}
          </select>
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={doPreview}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant/30 font-bold uppercase text-xs tracking-widest"
          >
            {draft ? "Re-seed" : "Generate seed"}
          </button>
          <button
            type="button"
            onClick={doCommit}
            disabled={
              pending ||
              !draft ||
              alreadyCommitted ||
              hasErrors ||
              (preview?.overCap ?? false)
            }
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest disabled:opacity-40"
          >
            Commit
          </button>
          <button
            type="button"
            onClick={doReset}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-tertiary text-on-tertiary font-bold uppercase text-xs tracking-widest"
          >
            Reset
          </button>
        </div>
      </div>

      {previewUtc && (
        <div className="text-[11px] text-on-surface-variant">
          Will commit as{" "}
          <span className="text-on-surface font-mono">{previewUtc}</span> (UTC)
          — {startAt.replace("T", " ")} in {timeZone}
        </div>
      )}

      {msg && (
        <div className="rounded-lg bg-surface-container-low p-3 text-sm">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg bg-error-container/40 border border-error/40 p-3 text-sm text-on-error-container">
          {err}
        </div>
      )}

      {preview && draft && (
        <>
          {preview.overCap && (
            <div className="rounded-xl bg-tertiary-container/40 border border-tertiary/40 p-4 text-sm space-y-2">
              <div className="font-bold text-tertiary uppercase tracking-widest text-xs">
                Speculative preview — commit blocked
              </div>
              <div className="text-on-surface-variant">
                Roster has <span className="font-mono">{preview.totalEligible}</span>{" "}
                eligible participants; cap is 64. Showing the top 64 by
                experience score. Run play-in first to qualify the bottom tier.
              </div>
              {preview.belowCap.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-on-surface-variant hover:text-on-surface">
                    {preview.belowCap.length} below cap (would need play-in)
                  </summary>
                  <ul className="mt-2 grid md:grid-cols-2 gap-x-4 gap-y-1">
                    {preview.belowCap.map((r) => (
                      <li
                        key={r.id}
                        className="flex justify-between gap-2"
                      >
                        <span>
                          <span className="text-on-surface-variant font-mono">
                            #{r.rank}
                          </span>{" "}
                          {r.name}
                        </span>
                        <span className="text-on-surface-variant">
                          {r.department} · {r.experienceScore}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {(duplicates.length > 0 || unassigned.length > 0) && (
            <div className="rounded-xl bg-error-container/30 border border-error/40 p-4 text-sm space-y-2">
              {duplicates.map((d) => (
                <div key={d.pid}>
                  <span className="font-bold text-on-error-container">
                    {d.name}
                  </span>{" "}
                  is in matchups{" "}
                  <span className="font-mono">
                    #{d.matchups.join(", #")}
                  </span>
                  .
                </div>
              ))}
              {unassigned.length > 0 && (
                <div>
                  Unassigned:{" "}
                  {unassigned.map((u) => u.name).join(", ")}
                </div>
              )}
              <button
                type="button"
                onClick={resetDraftToAutoSeed}
                className="mt-1 text-[10px] uppercase tracking-widest font-bold text-primary hover:underline"
              >
                Restore auto-seeded matchups
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
            {preview.pods.map((pod) => (
              <div
                key={pod.podId}
                className="rounded-lg bg-surface-container-low p-3 border border-outline-variant/10"
              >
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                  Pod {pod.podId} (auto-seed preview)
                </div>
                <ul className="space-y-1 text-xs">
                  {pod.members.map((m) => {
                    const rank = preview.roster.find(
                      (r) => r.id === m.id,
                    )?.rank;
                    return (
                      <li key={m.id} className="flex justify-between gap-2">
                        <span>
                          <span className="text-on-surface-variant font-mono">
                            {rank ? `#${rank}` : ""}
                          </span>{" "}
                          {m.name}
                        </span>
                        <span className="text-on-surface-variant">
                          {m.department} · {m.experienceScore}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                Round 1 matchups ({draft.length}) — edit freely
              </div>
              <button
                type="button"
                onClick={resetDraftToAutoSeed}
                className="text-[10px] uppercase tracking-widest font-bold text-primary hover:underline"
              >
                Reset to auto-seed
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {draft.map((row) => (
                <MatchupRow
                  key={row.matchupNo}
                  row={row}
                  roster={preview.roster}
                  assignmentsByPid={assignmentsByPid}
                  rosterById={rosterById}
                  onChange={updateSlot}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MatchupRow({
  row,
  roster,
  assignmentsByPid,
  rosterById,
  onChange,
}: {
  row: DraftMatchup;
  roster: RosterOption[];
  assignmentsByPid: Map<string, number[]>;
  rosterById: Map<string, RosterOption>;
  onChange: (matchupNo: number, side: "A" | "B", newId: string) => void;
}) {
  const aConflict = (assignmentsByPid.get(row.teamAId) ?? []).filter(
    (n) => n !== row.matchupNo,
  );
  const bConflict = (assignmentsByPid.get(row.teamBId) ?? []).filter(
    (n) => n !== row.matchupNo,
  );

  const hasConflict = aConflict.length > 0 || bConflict.length > 0;

  return (
    <div
      className={`p-3 rounded-lg text-xs space-y-2 ${
        hasConflict
          ? "bg-error-container/20 border border-error/40"
          : "bg-surface-container-lowest border border-outline-variant/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-on-surface-variant">
          Matchup #{row.matchupNo} · Pod {row.podId}
        </div>
      </div>
      <MatchupSlot
        side="A"
        matchupNo={row.matchupNo}
        selectedId={row.teamAId}
        roster={roster}
        assignmentsByPid={assignmentsByPid}
        rosterById={rosterById}
        onChange={onChange}
        conflictMatchups={aConflict}
      />
      <div className="text-center text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
        vs
      </div>
      <MatchupSlot
        side="B"
        matchupNo={row.matchupNo}
        selectedId={row.teamBId}
        roster={roster}
        assignmentsByPid={assignmentsByPid}
        rosterById={rosterById}
        onChange={onChange}
        conflictMatchups={bConflict}
      />
    </div>
  );
}

function MatchupSlot({
  side,
  matchupNo,
  selectedId,
  roster,
  assignmentsByPid,
  rosterById,
  onChange,
  conflictMatchups,
}: {
  side: "A" | "B";
  matchupNo: number;
  selectedId: string;
  roster: RosterOption[];
  assignmentsByPid: Map<string, number[]>;
  rosterById: Map<string, RosterOption>;
  onChange: (matchupNo: number, side: "A" | "B", newId: string) => void;
  conflictMatchups: number[];
}) {
  const selected = rosterById.get(selectedId);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant w-4">
          {side}
        </span>
        <select
          value={selectedId}
          onChange={(e) => onChange(matchupNo, side, e.target.value)}
          className={`flex-1 min-w-0 bg-surface-container-high border rounded-lg px-2 py-1.5 text-xs ${
            conflictMatchups.length > 0
              ? "border-error text-on-error-container"
              : "border-outline-variant/30"
          }`}
        >
          {roster.map((r) => {
            const inUse = (assignmentsByPid.get(r.id) ?? []).filter(
              (n) => n !== matchupNo,
            );
            const disabled = false; // allow picking so admin can see error + swap
            const label = `#${r.rank} ${r.name} · ${r.department} · ${r.experienceScore}${
              inUse.length > 0 ? `  (also in #${inUse.join(", #")})` : ""
            }`;
            return (
              <option
                key={r.id}
                value={r.id}
                disabled={disabled}
                style={
                  inUse.length > 0
                    ? { color: "var(--color-error, #ff6b6b)" }
                    : undefined
                }
              >
                {label}
              </option>
            );
          })}
        </select>
      </div>
      {selected && (
        <div className="text-[10px] text-on-surface-variant pl-6">
          rank #{selected.rank} · score {selected.experienceScore}
        </div>
      )}
      {conflictMatchups.length > 0 && (
        <div className="text-[10px] text-error font-bold pl-6">
          ⚠ already in matchup #{conflictMatchups.join(", #")} — swap to fix
        </div>
      )}
    </div>
  );
}

function SeedableBreakdownLine({
  breakdown,
}: {
  breakdown: SeedableBreakdown;
}) {
  const included: string[] = [];
  if (breakdown.roster > 0) included.push(`${breakdown.roster} roster`);
  if (breakdown.walkIns > 0) included.push(`${breakdown.walkIns} walk-ins`);
  if (breakdown.phantoms > 0) included.push(`${breakdown.phantoms} phantoms`);

  const excluded: string[] = [];
  if (breakdown.organizers > 0) {
    excluded.push(`${breakdown.organizers} organizer${breakdown.organizers === 1 ? "" : "s"}`);
  }
  if (breakdown.judges > 0) {
    excluded.push(`${breakdown.judges} judge${breakdown.judges === 1 ? "" : "s"}`);
  }

  if (included.length === 0 && excluded.length === 0) return null;

  return (
    <div className="mt-1 text-[10px] text-on-surface-variant leading-tight">
      {included.length > 0 && <span>{included.join(" · ")}</span>}
      {excluded.length > 0 && (
        <span className="ml-1 opacity-70">
          {included.length > 0 && "· "}
          {excluded.join(" · ")} excluded
        </span>
      )}
    </div>
  );
}
