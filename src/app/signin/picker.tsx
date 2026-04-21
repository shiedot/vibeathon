"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { GlobeBackground } from "@/components/globe-background";
import { enterAsParticipantAction } from "./actions";

type PickerParticipant = {
  id: string;
  name: string;
  department: string;
  employeeId: string;
};

export function ParticipantPicker({
  participants,
  callbackUrl,
}: {
  participants: PickerParticipant[];
  callbackUrl: string;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirming, setConfirming] = useState<PickerParticipant | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => {
    const m = new Map<string, PickerParticipant>();
    for (const p of participants) m.set(p.id, p);
    return m;
  }, [participants]);

  function onEnter() {
    setErr(null);
    const p = byId.get(selectedId);
    if (!p) {
      setErr("Pick yourself from the list first.");
      return;
    }
    setConfirming(p);
  }

  function onConfirm() {
    if (!confirming) return;
    const pid = confirming.id;
    start(async () => {
      const res = await enterAsParticipantAction(pid);
      if (!res.ok) {
        setErr(res.error);
        setConfirming(null);
        return;
      }
      window.location.href = callbackUrl;
    });
  }

  function onCancel() {
    setConfirming(null);
  }

  return (
    <main className="relative min-h-[calc(100dvh-6rem)] overflow-hidden">
      <GlobeBackground
        unroll={false}
        initialProgress={1}
        className="absolute inset-0 flex items-center justify-center"
        strokeOpacity={0.35}
      />

      <Link
        href="/"
        aria-label="The Vibe-a-thon — home"
        className="pointer-events-auto absolute top-6 left-6 z-10 inline-flex"
      >
        <Image
          src="/header_logo.svg"
          alt="The Vibe-a-thon"
          width={174}
          height={32}
          priority
          unoptimized
          className="h-8 w-auto"
        />
      </Link>

      <div className="pointer-events-none relative flex items-center justify-center px-6 min-h-[calc(100dvh-6rem)]">
        <div className="pointer-events-auto w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-label text-xs tracking-[0.2em] uppercase text-primary-fixed-dim font-bold">
                Step 2 of 2
              </span>
            </div>
            <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none">
              <span className="text-primary">Sign in</span>
            </h1>
          </div>

          {err && (
            <div className="mb-5 p-4 rounded-xl bg-error-container/30 border border-error/40 text-on-error-container text-sm">
              {err}
            </div>
          )}

          <label className="block mb-4">
            <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
              I am…
            </span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-3 text-base"
            >
              <option value="" disabled>
                — choose your name —
              </option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.department}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onEnter}
            disabled={pending || !selectedId}
            className="w-full kinetic-gradient text-on-primary font-headline font-black uppercase tracking-tight py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-[0_0_30px_rgba(69,237,207,0.25)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <FooterMark />
            Enter
          </button>

          <p className="mt-6 text-[10px] text-center text-on-surface-variant uppercase tracking-widest">
            Don&apos;t see your name? Ping the organizers.
          </p>
        </div>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
        >
          <div className="w-full max-w-sm bg-surface-container rounded-2xl border border-outline-variant/30 p-6 shadow-2xl">
            <h2 className="font-headline text-2xl font-black uppercase tracking-tighter mb-2">
              Confirm
            </h2>
            <p className="text-sm text-on-surface-variant mb-1">
              Entering as
            </p>
            <div className="text-lg font-bold mb-1">{confirming.name}</div>
            <div className="text-[11px] text-on-surface-variant mb-6">
              {confirming.department} · {confirming.employeeId}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="flex-1 py-3 rounded-lg bg-surface-container-high border border-outline-variant/30 font-bold uppercase text-xs tracking-widest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className="flex-1 py-3 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest disabled:opacity-50"
              >
                {pending ? "Entering…" : "Yes, that's me"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FooterMark() {
  return (
    <svg
      width="18"
      height="20"
      viewBox="0 0 168 192"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
    >
      <path d="M167.829 142.38 83.7734 0 107.045 120.291l60.784 22.089z" />
      <path d="M3.80469 146.159 167.828 146.157 52.4547 104.226 3.80469 146.159z" />
      <path d="M92.622 64.8195 81.0074 4.78809.5 144.221 92.622 64.8195z" />
    </svg>
  );
}
