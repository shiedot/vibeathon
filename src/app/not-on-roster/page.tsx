import Link from "next/link";
import { signOut, auth } from "@/auth";

export default async function NotOnRosterPage() {
  const session = await auth();
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-tertiary/10 border border-tertiary/30">
          <span className="material-symbols-outlined text-tertiary text-3xl">
            no_accounts
          </span>
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-black uppercase tracking-tighter">
          You&apos;re not on the roster <br />
          <span className="text-tertiary">yet.</span>
        </h1>
        <p className="text-on-surface-variant">
          We couldn&apos;t find{" "}
          <span className="font-mono text-primary">
            {session?.user?.email ?? "your email"}
          </span>{" "}
          in the Vibe-a-thon roster. Ask an organizer to add you (or check the
          email you signed in with).
        </p>
        <div className="flex gap-3 justify-center">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="px-5 py-3 rounded-lg bg-surface-container-high border border-outline-variant/30 font-headline font-bold uppercase text-xs tracking-widest"
            >
              Sign out and retry
            </button>
          </form>
          <Link
            href="/signin"
            className="px-5 py-3 rounded-lg bg-primary text-on-primary font-headline font-bold uppercase text-xs tracking-widest"
          >
            Back to sign-in
          </Link>
        </div>
      </div>
    </main>
  );
}
