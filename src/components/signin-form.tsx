"use client";

import { useCallback, useState } from "react";
import { signIn } from "next-auth/react";
import { GlobeBackground } from "@/components/globe-background";

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  AccessDenied: {
    title: "Sign-in not allowed.",
    body: "This Google account isn’t permitted for this app. Try another account or ask the organizers for access.",
  },
  Configuration: {
    title: "Config issue on our side.",
    body: "OAuth config is incomplete. Ping shie@ to fix the server env.",
  },
  Verification: {
    title: "Couldn't verify that login.",
    body: "Try again, or reach out to the organizers if this keeps happening.",
  },
};

export interface SignInFormProps {
  callbackUrl: string;
  error?: string;
}

/** How long to pause after the unroll animation before redirecting. */
const POST_UNROLL_DELAY_MS = 1000;

export function SignInForm({ callbackUrl, error }: SignInFormProps) {
  const [unroll, setUnroll] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const copy = error ? ERROR_COPY[error] : undefined;

  const handleClick = useCallback(() => {
    if (isStarting) return;
    setIsStarting(true);
    setUnroll(true);
  }, [isStarting]);

  const handleUnrollComplete = useCallback(() => {
    window.setTimeout(() => {
      void signIn("google", { callbackUrl });
    }, POST_UNROLL_DELAY_MS);
  }, [callbackUrl]);

  return (
    <main className="relative min-h-[calc(100dvh-6rem)] overflow-hidden">
      <GlobeBackground
        unroll={unroll}
        onUnrollComplete={handleUnrollComplete}
        className="absolute inset-0 flex items-center justify-center"
        strokeOpacity={0.55}
      />

      {/* pointer-events-none on the wrapper lets drag events pass through to
          the globe everywhere except the inner card (re-enabled below). */}
      <div className="pointer-events-none relative flex items-center justify-center px-6 min-h-[calc(100dvh-6rem)]">
        <div className="pointer-events-auto w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-label text-xs tracking-[0.2em] uppercase text-primary-fixed-dim font-bold">
                Travellers only
              </span>
            </div>
            <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none">
              Enter the <br />
              <span className="text-primary">Vibe-a-thon</span>
            </h1>
          </div>

          {copy && (
            <div className="mb-6 p-5 rounded-xl bg-error-container/30 border border-error/30 text-on-error-container backdrop-blur-sm">
              <div className="font-headline font-bold uppercase text-sm mb-1">
                {copy.title}
              </div>
              <p className="text-xs leading-relaxed opacity-90">{copy.body}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleClick}
            disabled={isStarting}
            className="w-full kinetic-gradient text-on-primary font-headline font-black uppercase tracking-tight py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-[0_0_30px_rgba(69,237,207,0.25)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <GoogleGlyph />
            {isStarting ? "Unfurling…" : "Get Started"}
          </button>
        </div>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <path
        fill="#1b1b1b"
        d="M21.35 11.1H12v2.88h5.35c-.23 1.48-1.68 4.34-5.35 4.34-3.22 0-5.85-2.66-5.85-5.93S8.78 6.46 12 6.46c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.82 3.98 14.67 3 12 3 6.98 3 2.92 7.03 2.92 12S6.98 21 12 21c6.92 0 9.44-4.84 9.44-9.2 0-.61-.05-1.07-.09-1.7z"
      />
    </svg>
  );
}
