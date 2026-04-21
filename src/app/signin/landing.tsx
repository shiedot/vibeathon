"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { GlobeBackground } from "@/components/globe-background";

const POST_UNROLL_DELAY_MS = 900;

export function Landing({ callbackUrl }: { callbackUrl: string }) {
  const [unroll, setUnroll] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setUnroll(true);
  }, [busy]);

  const handleUnrollComplete = useCallback(() => {
    const target = `/signin/pick?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    // Prefetch + push after a beat so the unfurl reads as intentional.
    router.prefetch(target);
    window.setTimeout(() => {
      router.push(target);
    }, POST_UNROLL_DELAY_MS);
  }, [callbackUrl, router]);

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

          <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            className="w-full kinetic-gradient text-on-primary font-headline font-black uppercase tracking-tight py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-[0_0_30px_rgba(69,237,207,0.25)] disabled:opacity-80 disabled:cursor-not-allowed"
          >
            <FooterMark />
            {busy ? "Entering…" : "Get Started"}
          </button>
        </div>
      </div>
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
