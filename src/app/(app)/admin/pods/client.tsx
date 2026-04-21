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

export function PodsClient({
  alreadyCommitted,
  travellersRegistered,
}: {
  alreadyCommitted: boolean;
  travellersRegistered: number;
}) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [timeZone, setTimeZone] = useState<string>(DEFAULT_TZ);
  const [startAt, setStartAt] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
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
        if (!res.ok) setMsg(res.error);
        else {
          setMsg(`Added ${res.data.added} phantom traveller(s).`);
          setPreview(null);
          router.refresh();
        }
        return;
      }
      for (let i = 0; i < Math.abs(delta); i += 1) {
        const res = await removeLastPhantomAction();
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        if (!res.data.removed) {
          setMsg("No phantom travellers left to remove.");
          break;
        }
      }
      setPreview(null);
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

  function doPreview() {
    const nextSeed = Math.floor(Math.random() * 1_000_000);
    setSeed(nextSeed);
    start(async () => {
      const res = await previewPodsAction(nextSeed);
      if (!res.ok) setMsg(res.error);
      else {
        setPreview(res.data);
        setMsg(null);
      }
    });
  }

  function doCommit() {
    if (alreadyCommitted) {
      setMsg("Reset first.");
      return;
    }
    start(async () => {
      const iso = zonedWallClockToUtcIso(startAt, timeZone);
      const res = await commitPodsAction(seed, iso);
      if (!res.ok) setMsg(res.error);
      else
        setMsg(
          `Committed: ${res.data.teamsCreated} teams, ${res.data.battlesCreated} battles.`,
        );
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
      if (!res.ok) setMsg(res.error);
      else {
        setPreview(null);
        setMsg("Tournament state wiped.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[1fr_1fr_1.2fr_auto] gap-4 items-end">
        <div className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Total Travellers registered
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={doPreview}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant/30 font-bold uppercase text-xs tracking-widest"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={doCommit}
            disabled={pending || !preview || alreadyCommitted}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
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

      {preview && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            {preview.pods.map((pod) => (
              <div
                key={pod.podId}
                className="rounded-lg bg-surface-container-low p-3 border border-outline-variant/10"
              >
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                  Pod {pod.podId}
                </div>
                <ul className="space-y-1 text-xs">
                  {pod.members.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>{m.name}</span>
                      <span className="text-on-surface-variant">
                        {m.department} · {m.experienceScore}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
              Round 1 matchups ({preview.r1Matchups.length})
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
              {preview.r1Matchups.map((m, i) => (
                <div
                  key={i}
                  className="p-3 bg-surface-container-lowest rounded-lg text-xs"
                >
                  Pod {m.podId}: {m.teamA.name}{" "}
                  <span className="text-on-surface-variant">vs</span>{" "}
                  {m.teamB.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
