"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeTravellerAction, setRoleAction } from "../actions";
import type { TravellerRow } from "@/server/travellers";

type Role = TravellerRow["role"];
const ROLES: Role[] = ["participant", "organizer", "judge"];

export function TravellersClient({
  rows,
  locked,
}: {
  rows: TravellerRow[];
  locked: boolean;
}) {
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const counts = useMemo(() => {
    const phantoms = rows.filter((r) => r.isPhantom).length;
    const organizers = rows.filter((r) => r.role === "organizer").length;
    const judges = rows.filter((r) => r.role === "judge").length;
    const participants = rows.filter((r) => r.role === "participant").length;
    return {
      total: rows.length,
      phantoms,
      real: rows.length - phantoms,
      organizers,
      judges,
      participants,
    };
  }, [rows]);

  function confirmRemove(row: TravellerRow) {
    if (locked) {
      setMsg("Roster is locked. Reset tournament first.");
      return;
    }
    const ok = window.confirm(
      `Remove ${row.name}?\n\n${row.email}\n${row.department} · ${row.employeeId}\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    start(async () => {
      const res = await removeTravellerAction(row.id);
      if (!res.ok) setMsg(res.error);
      else {
        setMsg(`Removed ${row.name}.`);
        router.refresh();
      }
    });
  }

  function changeRole(row: TravellerRow, next: Role) {
    if (next === row.role) return;
    const warn =
      next === "organizer" || next === "judge"
        ? `\n\n${row.name} will be excluded from seeding.`
        : "";
    const ok = window.confirm(
      `Change role for ${row.name} from ${row.role} → ${next}?${warn}`,
    );
    if (!ok) return;
    start(async () => {
      const res = await setRoleAction(row.id, next);
      if (!res.ok) setMsg(res.error);
      else {
        setMsg(`${row.name} is now ${next}.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 flex-1">
          <Stat label="Total" value={counts.total} />
          <Stat label="Seeded" value={counts.participants} />
          <Stat label="Organizers" value={counts.organizers} />
          <Stat label="Judges" value={counts.judges} />
          <Stat label="Phantom" value={counts.phantoms} />
        </div>
        <input
          type="search"
          placeholder="Filter by name, email, dept, employee id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[260px] bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {msg && (
        <div className="rounded-lg bg-surface-container-low p-3 text-sm">
          {msg}
        </div>
      )}

      <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Dept</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Skill</th>
              <th className="text-left p-3">Kind</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-outline-variant/10">
                <td className="p-3 font-bold">{r.name}</td>
                <td className="p-3 text-xs text-on-surface-variant truncate max-w-[220px]">
                  {r.email}
                </td>
                <td className="p-3 text-xs">{r.department}</td>
                <td className="p-3 text-xs">
                  <select
                    value={r.role}
                    disabled={pending}
                    onChange={(e) => changeRole(r, e.target.value as Role)}
                    className={`bg-surface-container-high border border-outline-variant/30 rounded px-2 py-1 text-[10px] uppercase font-bold tracking-widest disabled:opacity-40 ${
                      r.role === "organizer"
                        ? "text-primary"
                        : r.role === "judge"
                          ? "text-tertiary"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-xs text-on-surface-variant">
                  {r.comfortLevel} · {r.yearsCoding}y
                </td>
                <td className="p-3">
                  {r.isPhantom ? (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-tertiary">
                      Phantom
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-primary">
                      Registered
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    disabled={pending || locked}
                    onClick={() => confirmRemove(r)}
                    className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-tertiary/20 text-tertiary disabled:opacity-40"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-on-surface-variant text-xs"
                >
                  No travellers match that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/10 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
        {label}
      </div>
      <div className="text-2xl font-black font-mono tabular-nums">{value}</div>
    </div>
  );
}
