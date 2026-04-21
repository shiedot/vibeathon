import { SettlementClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminSettlementPage() {
  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Settlement
        </h1>
        <p className="text-on-surface-variant text-sm">
          Finalize prize ledger: bankroll + consolation + bet winnings + named
          prizes + 200 ₿ floor. Commit writes the ledger; CSV export is for
          payouts.
        </p>
      </header>
      <SettlementClient />
    </main>
  );
}
