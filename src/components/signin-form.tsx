"use client";

import Image from "next/image";
import Link from "next/link";
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
            <FooterMark />
            {isStarting ? "Unfurling…" : "Get Started"}
          </button>
        </div>
      </div>
    </main>
  );
}

/**
 * Footer/brand mark used inside the Get Started button. Inlined so `fill`
 * reads from `currentColor`, which lets the mark pick up the button's
 * `text-on-primary` color (dark on the green kinetic-gradient).
 */
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
