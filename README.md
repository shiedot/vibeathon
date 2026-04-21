# The Vibe-a-thon

Full Throttle 2026 — TravelAI Bangladesh tournament app. Next.js 16 (App Router)
+ TypeScript + Tailwind v4 + Drizzle ORM + Neon Postgres, deployable on Vercel.

One question in every line of code:

> How does this serve the Traveler?

## Stack

- **Next.js 16 / React 19** — App Router, server components by default
- **TypeScript** — strict
- **Tailwind CSS v4** — design system tokens in `src/app/globals.css`
- **Drizzle ORM + pg** — Postgres schema in `src/db/schema.ts`
- **NextAuth v5 (Google)** — database sessions via `@auth/drizzle-adapter`
- **SWR** — 2–3 s polling for every live surface
- **Vitest** — pure-lib unit tests

## Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — current round, bankroll, recent ledger |
| `/matchup` | My current matchup + vote button |
| `/bracket` | Full bracket (live) |
| `/betting` | Parimutuel hub; place/lock bets |
| `/prizes` | Prize ledger + leaderboards |
| `/nominate` | Best Coach nominations (max 3/participant) |
| `/history` | Personal ₿ ledger |
| `/judge`, `/judge/deadlocks`, `/judge/vote`, `/judge/coaches` | Judge console |
| `/admin`, `/admin/roster`, `/admin/pods`, `/admin/play-in`, `/admin/battles`, `/admin/betting`, `/admin/bankroll`, `/admin/timing`, `/admin/audit`, `/admin/overrides`, `/admin/settlement` | Organizer console |
| `/spectator` | Public big-screen view (QF onward public) |

## Getting started

```bash
pnpm install
cp .env.example .env        # fill in Neon + Google + ORGANIZER_EMAILS
pnpm db:generate            # generate SQL from src/db/schema.ts
pnpm db:migrate             # apply SQL migrations to Neon
pnpm dev
pnpm test                   # vitest unit suites
```

Open <http://localhost:3000>. Sign in with an email listed in
`ORGANIZER_EMAILS` to get the admin dashboard.

## Money math

Pure TypeScript in `src/lib/bankroll.ts`:

- `resolveBattle({winnerTeamPot, loserTeamPot})` — winner pot =
  `round(pool × 0.8)`, losing captain's consolation = `pool − pot`.
- `projectWinnerPot(1000, n)` matches the spec table 5/6 rows exactly (R1 →
  1,600; R2 → 2,560; R3 → 4,096; QF → 6,554; SF → 10,486; Final → **16,778**,
  one ₿ above the spec's headline 16,777 — the spec's six-row table is not
  internally consistent under any single rounding rule).
- `settleParimutuel(bets, winnerId)` — losers' pool goes proportionally to
  winning bettors; leftover ₿ sweeps to the largest winner to conserve money.

Every ₿ movement is recorded in `bankroll_ledger` with the actor's user ID.
`/admin/audit` continuously verifies
`Σ bankrolls + Σ team_pots + Σ open_bet_stakes == 1000 × participants +
organizer bonuses`.

## Runbook

See [RUNBOOK.md](./RUNBOOK.md) for the full Wednesday-through-Friday procedure,
including what to do when something breaks.

## Deploy to Vercel

1. Push to GitHub.
2. Import on Vercel, add env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ORGANIZER_EMAILS`, optionally
   `GOOGLE_ALLOWED_DOMAIN`.
3. Run `pnpm db:migrate` once against the target database.
