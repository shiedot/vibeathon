# The Vibe-a-thon

Full Throttle 2026 — TravelAI Bangladesh tournament app. Next.js 15 (App Router)
+ TypeScript + Tailwind v4 + Drizzle ORM + Neon Postgres, deployable on Vercel.

One question in every line of code:

> How does this serve the Traveler?

## Stack

- **Next.js 16 / React 19** — App Router, server components by default
- **TypeScript** — strict
- **Tailwind CSS v4** — design system tokens live in `src/app/globals.css` under
  `@theme`. Ported from the provided mockups (teal `#45edcf` primary, tertiary
  `#ffce5e`, surface `#121416`, Space Grotesk + Inter + Material Symbols).
- **Drizzle ORM + Neon serverless** — Postgres schema in `src/db/schema.ts`
  mirrors §10 of the app spec
- **Deployed on Vercel** — Neon's HTTP driver is edge-friendly

## Routes

| Route        | Purpose                                                       |
| ------------ | ------------------------------------------------------------- |
| `/`          | Dashboard — round countdown, bankroll, Traveler Test, pulse   |
| `/bracket`   | Pod bracket visualisation + insights                          |
| `/matchup`   | Head-to-head matchup + consensus voting                       |
| `/betting`   | Parimutuel betting hub, wager control, live exposure          |
| `/prizes`    | Grand Champion, scout leaderboard, named prizes, Best Coach   |
| `/admin`     | Organizer console (stubs for roster, pods, battles, etc.)     |

## Getting started

```bash
pnpm install
cp .env.example .env.local    # paste your Neon connection string
pnpm db:generate              # create SQL from schema
pnpm db:push                  # apply to Neon (or db:migrate for versioned)
pnpm dev
```

Open <http://localhost:3000>.

## Core logic

Pure TypeScript, unit-testable, no React deps:

- `src/lib/bankroll.ts` — `resolveBattle`, `projectWinnerPot`,
  `settleParimutuel`, `canBet`. Implements §3 (80/20 split) and §6
  (parimutuel + eligibility) of the spec.

The pot progression from the spec (§3) is enforced by `projectWinnerPot`:

| Round | Team size | `projectWinnerPot(1000, rounds)` |
| ----- | --------- | -------------------------------- |
| R1    | 2         | 1,600                            |
| R2    | 4         | 2,560                            |
| R3    | 8         | 4,096                            |
| QF    | 16        | 6,553                            |
| SF    | 32        | 10,485                           |
| Final | 64        | 16,776                           |

(₿ rounds down to conserve money — leftovers go to losing-captain consolation.)

## Database

Drizzle schema in `src/db/schema.ts` covers every entity from §10 of the spec:
`participants`, `teams`, `team_members`, `battles`, `consensus_votes`, `bets`,
`coach_nominations`, `prize_ledger`.

Enums mirror spec vocab: `setup_status`, `battle_status`, `play_in_role`, etc.
All money is stored as integer ₿ (1 ₿ = ৳1).

## Deploy to Vercel

1. Push to GitHub.
2. Import on Vercel, add `DATABASE_URL` to project env vars.
3. Vercel detects Next.js automatically. Neon's HTTP driver works in the edge
   runtime out of the box.

## What's stubbed vs done

**Done:** design system, layout, 5 participant pages, admin index, Drizzle
schema, bankroll engine.

**Stubbed (next):** auth, CSV ingestion, pod/seeding logic, battle lifecycle
mutations, bet placement + settlement actions, realtime (consider PartyKit or
Pusher for live matchup/bet pool updates).

See `vibeathon_app_spec.md` §13 for the MVP build order.
