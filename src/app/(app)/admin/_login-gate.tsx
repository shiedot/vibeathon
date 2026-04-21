"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { enterAdminAction } from "@/app/signin/actions";

export function AdminLoginGate() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await enterAdminAction(password);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          <span className="font-label text-xs tracking-[0.2em] uppercase text-tertiary font-bold">
            Admin only
          </span>
        </div>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Password required
        </h1>
        <p className="text-on-surface-variant text-sm mt-2">
          Enter the organizer password to unlock the admin console.
        </p>
      </header>

      {err && (
        <div className="rounded-xl bg-error-container/30 border border-error/40 p-4 text-sm text-on-error-container">
          {err}
        </div>
      )}

      <label className="block">
        <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
          Admin password
        </span>
        <input
          type="password"
          autoComplete="off"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-3 text-base font-mono"
        />
      </label>

      <button
        type="submit"
        disabled={pending || password.length === 0}
        className="w-full py-3 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest disabled:opacity-40"
      >
        {pending ? "Checking…" : "Unlock admin"}
      </button>
    </form>
  );
}
