"use client";

import { useRef, useState, useTransition } from "react";
import {
  ingestCsvAction,
  markAllReadyAction,
  setRoleAction,
  setSetupStatusAction,
} from "../actions";

type Row = {
  id: string;
  name: string;
  email: string;
  department: string;
  employeeId: string;
  role: "participant" | "organizer" | "judge";
  setupStatus: "incomplete" | "pending_review" | "ready";
  yearsCoding: number;
  comfortLevel: number;
  completedTestPr: boolean;
};

export function RosterClient({ rows }: { rows: Row[] }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function onUpload(file: File) {
    const text = await file.text();
    start(async () => {
      const res = await ingestCsvAction(text);
      if (!res.ok) setMsg(res.error);
      else {
        setMsg(
          `Inserted ${res.data.inserted}, updated ${res.data.updated}${
            res.data.errors.length
              ? `, ${res.data.errors.length} errors`
              : ""
          }`,
        );
      }
    });
  }

  function doStatus(id: string, s: Row["setupStatus"]) {
    start(async () => {
      const res = await setSetupStatusAction(id, s);
      if (!res.ok) setMsg(res.error);
    });
  }
  function doRole(id: string, role: Row["role"]) {
    start(async () => {
      const res = await setRoleAction(id, role);
      if (!res.ok) setMsg(res.error);
    });
  }
  function allReady() {
    start(async () => {
      const res = await markAllReadyAction();
      if (!res.ok) setMsg(res.error);
      else setMsg(`Marked ${res.data.count} participants ready.`);
    });
  }

  const filtered = rows.filter((r) => {
    const q = filter.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Upload roster CSV
          </label>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-headline font-bold uppercase text-xs tracking-widest"
            >
              Upload CSV
            </button>
            <a
              href="/api/admin/roster-template"
              className="px-4 py-2 rounded-lg border border-outline-variant/30 text-xs uppercase tracking-widest font-bold text-on-surface-variant"
            >
              Download template
            </a>
            <button
              type="button"
              onClick={allReady}
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-tertiary text-on-tertiary font-headline font-bold uppercase text-xs tracking-widest"
            >
              Mark all ready
            </button>
          </div>
        </div>
        {msg && <div className="text-xs text-primary font-bold">{msg}</div>}
      </div>

      <input
        type="text"
        placeholder="Filter by name, email, department"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-2"
      />

      <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Dept</th>
              <th className="text-left p-3">Exp</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-outline-variant/10">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-on-surface-variant">{r.email}</td>
                <td className="p-3">{r.department}</td>
                <td className="p-3 text-on-surface-variant">
                  c{r.comfortLevel}·{r.yearsCoding}y
                </td>
                <td className="p-3">
                  <select
                    value={r.setupStatus}
                    onChange={(e) =>
                      doStatus(r.id, e.target.value as Row["setupStatus"])
                    }
                    className="bg-surface-container-high border border-outline-variant/30 rounded px-2 py-1 text-xs"
                  >
                    <option value="incomplete">incomplete</option>
                    <option value="pending_review">pending_review</option>
                    <option value="ready">ready</option>
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={r.role}
                    onChange={(e) =>
                      doRole(r.id, e.target.value as Row["role"])
                    }
                    className="bg-surface-container-high border border-outline-variant/30 rounded px-2 py-1 text-xs"
                  >
                    <option value="participant">participant</option>
                    <option value="judge">judge</option>
                    <option value="organizer">organizer</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
