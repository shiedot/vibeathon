"use client";

import { useState, useTransition } from "react";
import { nominateCoachAction } from "@/app/actions";

type SearchResult = { id: string; name: string; department: string };

export function NominateForm({ remaining }: { remaining: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function doSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(
      `/api/participants/search?q=${encodeURIComponent(q)}`,
    );
    if (res.ok) {
      setResults(await res.json());
    }
  }

  function submit() {
    if (!selected) return setErr("Pick a Traveller");
    if (reason.trim().length < 5)
      return setErr("Give a one-sentence reason (5+ chars)");
    setErr(null);
    start(async () => {
      const res = await nominateCoachAction({
        nomineeId: selected.id,
        reason: reason.trim(),
      });
      if (!res.ok) setErr(res.error);
      else {
        setOk(true);
        setSelected(null);
        setReason("");
        setQuery("");
        setResults([]);
      }
    });
  }

  if (remaining <= 0) {
    return (
      <div className="rounded-lg bg-surface-container-low p-4 text-on-surface-variant text-sm">
        You&apos;ve used all 3 nominations. Thanks for paying attention.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-4">
      <div>
        <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
          Find Traveller
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          placeholder="Name or email"
          className="w-full mt-1 bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-3 font-medium"
        />
        {results.length > 0 && (
          <ul className="mt-2 rounded-lg bg-surface-container-highest border border-outline-variant/20 divide-y divide-outline-variant/10 max-h-64 overflow-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setQuery(r.name);
                    setResults([]);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-primary/10"
                >
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-on-surface-variant">{r.department}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && (
          <div className="mt-2 text-xs text-primary font-bold uppercase tracking-widest">
            Nominating: {selected.name}
          </div>
        )}
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
          Why? (one sentence)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full mt-1 bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-3"
        />
      </div>

      {err && <div className="text-tertiary text-sm">{err}</div>}
      {ok && <div className="text-primary text-sm">Nomination recorded.</div>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="kinetic-gradient text-on-primary font-headline font-black uppercase tracking-tight px-6 py-3 rounded-lg"
      >
        Submit nomination ({remaining} left)
      </button>
    </div>
  );
}
