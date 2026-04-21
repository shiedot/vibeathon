# Vibe-a-thon event runbook

Two-day operating guide for the organizer(s) running Full Throttle. Assumes the
app is deployed, `ORGANIZER_EMAILS`, `GOOGLE_ALLOWED_DOMAIN`, `AUTH_SECRET`,
`AUTH_URL`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are set.

Every screen polls every 2–3 seconds; you never need to refresh.

## Wednesday evening (setup)

1. **Log in** at the app with an address in `ORGANIZER_EMAILS`. A synthetic
   organizer participant row is created on first login.
2. Visit `/admin/roster`:
   - Download the CSV template.
   - Fill in every Traveller (required: `name`, `email`, `department`,
     `employee_id`, `years_coding`, `comfort_level`).
   - Upload. The importer is idempotent keyed by `employee_id`.
   - Travellers whose `completed_test_pr=Y` become `ready` automatically.
     Review others in the roster table, bump `setup_status` to `ready` when
     they're cleared.
3. If the roster has > 64 participants, go to `/admin/play-in` now.
   - Click **Preview pairings** to see the David-vs-Goliath lineup.
   - Set the play-in start time. Click **Commit** to create the pairing
     battles. They start in `pending`.

## Thursday morning

### 8:00 – 9:30 Play-in (only if you ran the preview above)
- At start time, for each pending play-in battle in `/admin/play-in`, click
  **Junior wins** or **Senior wins** once the judges decide.
  - Junior upset: senior gets 500 ₿ Mentor's Honor, junior enters main bracket.
  - Senior win: junior gets 200 ₿ Learner's Bankroll (betting-only).

### 9:30 Pods
- `/admin/pods`: click **Preview** to see the snake-draft result.
- Pick your R1 scheduled start (10:05 Thursday).
- Click **Commit**. The system creates 64 solo teams (each with 1000 ₿ pot)
  and 32 R1 battles in `pending`.
- The `/bracket` page becomes public-ready.

### 10:05 Kick off R1
- `/admin/battles`: click **Start all R1 pending**. Every battle flips to
  `voting`, `actualStart = now`, and `betting_closes_at = now + 117.5 min`
  (midpoint of the 235-minute round).

### 14:00 R1 voting + betting close
- Betting auto-locks at `betting_closes_at`; nothing to click.
- Teams submit votes via `/matchup`. When a majority is reached, the battle
  auto-resolves:
  - Pot transfer (`round(pool * 0.8)` to winner, remainder to losing captain).
  - Losing members move into the winner's team.
  - Bets on the battle settle parimutuel.
  - If every R1 battle in a pod is resolved, the next round's 16 R2 matchups
    auto-generate in `pending` (scheduled 10 minutes from now).
- Any deadlocks bubble to `/judge/deadlocks`.

### 14:00 → end of day
- Repeat "start all R2 pending", then R3, then QF.
- Keep an eye on `/admin/audit`: the red banner means the money-conservation
  invariant failed and a manual fix is needed (use `/admin/overrides`).

## Friday

### 10:00 SF
- Start SF battles. Judges can now cast SF/Final votes via `/judge/vote`
  (max 3 judges per matchup). Each judge vote counts like one member vote.

### 14:30 Final build + 16:00 Final
- Start the Final battle. Same mechanic.

### 17:00 Awards + settlement
- `/admin/settlement`:
  - (Optional) paste the Best Coach participant UUID — get it from
    `/judge/coaches`.
  - Click **Preview** to sanity-check per-participant totals.
  - Click **Commit** to write `prize_ledger`.
  - Click **Download CSV** to hand to finance/payouts.

## Things that break and how to fix

| Symptom | Where | How |
|---|---|---|
| Wrong winner on a battle | `/admin/overrides` → Battle tab | **Reverse resolution**, restore teams / refund bets / remove next-round matchups; then re-run voting. |
| Someone's bankroll is off | `/admin/overrides` → Bankroll tab | Enter ±Δ with a reason. Recorded as `admin_override` in the ledger. |
| Wrong team pot | `/admin/overrides` → Team tab | Same, but on `teams.team_pot`. |
| Traveller on wrong team | `/admin/overrides` → Team tab → Move participant | Moves membership, sets `current_team_id`, writes a ledger row. |
| Bad bet to refund | `/admin/overrides` → Bet tab | Refunds stake to bankroll, marks `refunded=true`. |
| Need to extend a round | `/admin/timing` | Push any battle's `betting_closes_at` forward. Reflected on `/matchup` + `/betting` within 3s. |
| No-show at R1 start | `/admin/overrides` → Battle → **Force resolve** (pick the opponent) with reason "no-show". |

## Conservation check

`/admin/audit` (and the small card at top of `/admin`) continuously verifies:

`Σ personal_bankroll + Σ team_pot + Σ open_bet_stakes ==
1000 × participants + Σ mentor_honor_bonus + Σ learner_bankroll`

A non-zero delta means something's drifted; every ledger row with
`kind='admin_override'` carries the organizer's user ID so you can audit
who did what.

## Big screen

Point a display at `/spectator` — public, no auth, polls every 3s. Shows
active battles, QF→Final bracket, top bankrolls, top scouts.
