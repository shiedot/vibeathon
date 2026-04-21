
---

## How does this serve the Traveler?

The question is surfaced as a permanent prompt on the participant dashboard and
printed into every pitch/voting view.

- Participant dashboard: [`https://vibeathon-alpha.vercel.app/`](https://vibeathon-alpha.vercel.app/)
- Code: `src/app/(app)/page.tsx` — "The Traveler Test" card (line ~94-121).

---

## The Rules, In Short

### You start with 1,000 TravellerBux (₿). These are real. They redeem for travel vouchers, company-paid travel, and travel-related activities. 1,000 ₿ = ৳1,000.

- Seeded automatically when R1 is committed. Every Traveller starts with
  `personalBankroll = 1000`, then immediately stakes it into their solo team
  pot (net zero — money conservation).
- Participant sees their current bankroll on [`/`](https://vibeathon-alpha.vercel.app/)
  ("Portfolio overview") and a full ledger on
  [`/history`](https://vibeathon-alpha.vercel.app/history).
- Organizer overview of every wallet:
  [`/admin/bankroll`](https://vibeathon-alpha.vercel.app/admin/bankroll).
- Code: `src/server/pods.ts` (`commitPodsAndR1` — seeds 1000 ₿ and inserts the
  `seed` + `stake` ledger rows), `src/db/schema.ts`
  (`participants.personalBankroll`).

### You build solo in Round 1. Your project must put the Traveler at the heart of what it does. If it doesn't, it won't survive.

- Round 1 is generated as 1-vs-1 battles inside each pod; a team per Traveller
  is created at commit.
- Admin seeds R1: [`/admin/pods`](https://vibeathon-alpha.vercel.app/admin/pods) — preview
  (random pairings via seeded shuffle) then commit.
- Participant sees their R1 matchup on
  [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) once it starts.
- Code: `src/lib/seeding.ts` (`generateR1Matchups` — seeded Mulberry32 RNG,
  soft-avoids same-department, prefers matching pitch language),
  `src/server/pods.ts` (`commitPodsAndR1`).

### You battle head-to-head. Two Travellers, two ideas, one winner. The combined team votes by majority to pick the best project. The loser joins the winner's team.

- Participant voting:
  [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) — one big green button per team,
  one vote per participant (upsert).
- Live tally + real-time vote feed for organizers (the "ticker"):
  [`/admin/voting-booth`](https://vibeathon-alpha.vercel.app/admin/voting-booth).
- Compact tally inline on each battle row, with expand-for-details:
  [`/admin/battles`](https://vibeathon-alpha.vercel.app/admin/battles).
- Code: `src/server/battles.ts` (`castVote`, `attemptResolve`,
  `resolveWithWinner` — also handles "loser joins winner" by rewriting
  `team_members` rows), `src/lib/voting.ts` (majority math).

### You battle again. And again. Teams of 2 become teams of 4. Teams of 4 become teams of 8. After six rounds, one team of 32 stands against another in the Grand Final.

- Next-round matchups are generated automatically the moment every battle in
  round N resolves (`maybeAdvanceRound`). R1→R2 and R2→R3 pair winners within
  the same pod. R3→QF pairs pods `[1,2][3,4][5,6][7,8]`. QF→SF, SF→Final pair
  remaining winners in order.
- Watch the bracket fill in live:
  [`/bracket`](https://vibeathon-alpha.vercel.app/bracket) (participant) and
  [`/admin/battles`](https://vibeathon-alpha.vercel.app/admin/battles) (organizer).
- Code: `src/lib/round-advance.ts` (`advanceRound`), `src/server/battles.ts`
  (`maybeAdvanceRound`).

---

## How the Money Works

### Every battle, both teams put their full team pot on the line.

- Stakes are written onto each `battles` row at resolution: `stakeA`, `stakeB`,
  `combinedPool`.
- Pot per team visible on the matchup page ("Team pot" stat) at
  [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) and per node on
  [`/bracket`](https://vibeathon-alpha.vercel.app/bracket).
- Code: `src/lib/bankroll.ts` (`resolveBattle` — `combinedPool = winnerPot +
  loserPot`), `src/server/battles.ts` (`resolveWithWinner`).

### Winner's team takes 80% of the combined stakes into their new team pot.

- Implemented as `Math.round(combinedPool * 0.8)`. The winning team's `team_pot`
  is updated in-place; a `bankroll_ledger.kind = 'win_pot'` row records the
  delta.
- Audit view for organizers:
  [`/admin/audit`](https://vibeathon-alpha.vercel.app/admin/audit) and the
  **Money Conservation** banner at the bottom of
  [`/admin`](https://vibeathon-alpha.vercel.app/admin).
- Code: `src/lib/bankroll.ts` (`WINNER_SHARE = 0.8`), `src/server/battles.ts`
  (`resolveWithWinner` lines ~239-263).

### Losing team's captain pockets 20% personally. They can share with teammates. Or not. Up to them.

- The remainder (`combinedPool - newWinnerTeamPot`) is credited to the losing
  captain's `personalBankroll`; a `bankroll_ledger.kind = 'consol'` row is
  inserted with reason "R{N} losing-captain 20% consolation".
- Captain sees the delta on
  [`/`](https://vibeathon-alpha.vercel.app/) ("Recent ₿ movement") and
  [`/history`](https://vibeathon-alpha.vercel.app/history).
- **GAP:** there is no in-product mechanism for the losing captain to split
  their 20% among ex-teammates. The money sits in their personal bankroll
  until the event ends. Organizer can simulate a split manually via
  [`/admin/overrides`](https://vibeathon-alpha.vercel.app/admin/overrides) (bankroll
  adjustments).
- Code: `src/server/battles.ts` (`resolveWithWinner` — "Losing captain pockets
  20%" block).

### Teammates of the losing captain transfer to the winning team with whatever is already in their personal bankroll.

- On resolve: `team_members.leftAt` is set for loser members, new rows are
  inserted on the winner team, and `participants.currentTeamId` +
  `eliminatedByTeamId` are updated. `personalBankroll` is **not** touched, so
  scouts carry their ₿ into the new team.
- The transferred Traveller sees their new team on
  [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) the next round; their bankroll
  on [`/`](https://vibeathon-alpha.vercel.app/) is unchanged.
- Code: `src/server/battles.ts` (`resolveWithWinner` — "Transfer loser members
  into winner team" loop).

### The captain is whoever won the last battle that formed the team.

- At R1 commit, each solo team's `captainId` is the sole member. When a team
  wins, it keeps its `captainId` and merely absorbs new members. When a team
  loses, it is deactivated (`isActive = false`) and its captain stops being a
  captain at the same moment they pocket the 20%.
- Participant sees the "Captain" pill next to the captain's name on
  [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) ("My team" panel).
- Code: `src/server/pods.ts` (captain seeded at R1 commit),
  `src/server/battles.ts` (`resolveWithWinner` — captain stays on winner team).

### If you win Round 1, you're the captain of your team of 2. You stay captain as long as your team keeps winning. You only lose captaincy by losing a battle — at which point you pocket the 20% consolation and join the winning side as a team member.

- Same mechanics — R1 captaincy propagates through the
  `teams.lineage_root_captain_id` column, which is also used to enforce
  betting-eligibility (you can't bet on matchups that include the team whose
  lineage you originated on).
- Code: `src/server/battles.ts` (`resolveWithWinner`, `reverseResolution`),
  `src/lib/bankroll.ts` (`canBet` — lineage check).

### The Grand Champion captain is the only Traveller who never lost a battle. They walk away with the final team pot of 16,777 ₿ plus the Founder's Prize.

- Settlement view (admin only):
  [`/admin/settlement`](https://vibeathon-alpha.vercel.app/admin/settlement) — preview rows
  per Traveller, commit, CSV export.
- Participant-facing prize info:
  [`/prizes`](https://vibeathon-alpha.vercel.app/prizes).
- Code: `src/server/settlement.ts` (`computeSettlement`, `commitSettlement`,
  `settlementToCsv`), `src/lib/bankroll.ts` (`projectWinnerPot` — the math
  that produces ~16,778 ₿ assuming clean 80/20 rounding).

---

## The Bracket

### 8 pods of 8. You're assigned to a pod. Rounds 1 through 3 happen inside your pod. Pitches stay private within pods until the quarterfinals.

- Organizer creates pods using a snake-draft by experience score (descending),
  then soft-constraints pair within each pod (avoid same-department, prefer
  matching pitch language).
- This takes place in
  [`/admin/pods`](https://vibeathon-alpha.vercel.app/admin/pods). If you need to adjust
  the roster first, visit
  [`/admin/travellers`](https://vibeathon-alpha.vercel.app/admin/travellers) (add phantoms
  via +/-, remove non-participants).
- Participant views their pod + R1 matchup on
  [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) and the wider bracket at
  [`/bracket`](https://vibeathon-alpha.vercel.app/bracket).
- Code: `src/lib/seeding.ts` (`snakeDraftPods`, `pairWithinPod`),
  `src/server/pods.ts` (`commitPodsAndR1`), `src/server/travellers.ts`
  (phantom +/-, hard remove).

### Pod → Quarterfinal → Semifinal → Final.

- Advancement runs automatically at resolution. Manual override if a round
  needs to be regenerated (e.g. after a DQ-both):
  [`/admin/overrides`](https://vibeathon-alpha.vercel.app/admin/overrides)
  ("Regenerate round N matchups").
- Code: `src/lib/round-advance.ts`, `src/server/battles.ts`
  (`maybeAdvanceRound`).

### Round schedule — Round 1 (Thu 10:05am) … Final (Fri 4:00pm)

| Round       | Matchup | Battles | When          |
|-------------|---------|---------|---------------|
| Round 1     | 1 vs 1  | 32      | Thu 10:05am   |
| Round 2     | 2 vs 2  | 16      | Thu 2:00pm    |
| Round 3     | 4 vs 4  | 8       | Thu 4:30pm    |
| Quarterfinal| 8 vs 8  | 4       | Thu 6:00pm    |
| Semifinal   | 16 vs 16| 2       | Fri 10:00am   |
| Final       | 32 vs 32| 1       | Fri 4:00pm    |

- Round durations + betting-close minutes are defined in `src/lib/time.ts`
  (`ROUND_DEFS`, `bettingClosesAt`). Admin adjusts the clock per battle at
  [`/admin/timing`](https://vibeathon-alpha.vercel.app/admin/timing).
- The R1 kickoff time itself is set when committing pods at
  [`/admin/pods`](https://vibeathon-alpha.vercel.app/admin/pods) ("Round 1 scheduled
  start").

### Play-in (only if >64 registered)

- Not in the printed rules, but it's the overflow mechanism: juniors
  (comfort ≤ 2 AND ≤ 2 years coding) vs senior volunteers (comfort ≥ 3). The
  winner takes the slot; losers get a consolation bankroll.
  - Junior upset → 500 ₿ Mentor's Honor to the senior (out of bracket).
  - Senior wins → 200 ₿ Learner's Bankroll to the junior (out, but can bet as
    a scout).
- Admin: [`/admin/play-in`](https://vibeathon-alpha.vercel.app/admin/play-in).
- Code: `src/lib/pairing.ts` (`generatePlayInPairings`),
  `src/server/playin.ts` (`previewPlayIn`, `commitPlayIn`, `resolvePlayIn`).

---

## Voting

### At the end of each battle, both teams combine to vote. Simple majority wins.

- Participant voting UI: [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) — each
  combined-team member gets one vote; changing your mind updates the same
  `(battleId, voterId)` row.
- Organizer real-time view of every vote as it lands:
  [`/admin/voting-booth`](https://vibeathon-alpha.vercel.app/admin/voting-booth) — green
  flash for Team A, red for Team B, newest on top.
- Admin control panel for starting battles / locking bets:
  [`/admin/battles`](https://vibeathon-alpha.vercel.app/admin/battles).
- Code: `src/server/battles.ts` (`castVote`, `attemptResolve`),
  `src/lib/voting.ts` (`tallyVotes`, `evaluateConsensus`),
  `src/server/voting-booth.ts` (live data), `src/app/(app)/admin/voting-booth/`
  (UI).

### If you can't reach a majority, you try again. If you're still deadlocked, a judge steps in — they can make the call, flip a coin, or disqualify both teams.

- When `evaluateConsensus` returns `deadlocked`, the battle status flips to
  `deadlocked` and it appears for judges at
  [`/judge/deadlocks`](https://vibeathon-alpha.vercel.app/judge/deadlocks) with three
  actions: **Pick winner**, **Flip coin**, **DQ both**.
- Organizer can also DQ both directly from
  [`/admin/battles`](https://vibeathon-alpha.vercel.app/admin/battles) (per-row **DQ both**
  button).
- DQ-both → `battles.status = 'disqualified'`, both teams deactivated. The
  next round's opponent advances with a bye (handled by
  `maybeAdvanceRound`).
- Code: `src/server/battles.ts` (`judgeDecide`), `src/lib/voting.ts`
  (`evaluateConsensus` — `deadlocked` branch).

### SF/Final judge votes

- In rounds 5 and 6, judges can also cast a vote — each judge vote counts as
  one team-member vote, max 3 per matchup.
- Judge UI: [`/judge/vote`](https://vibeathon-alpha.vercel.app/judge/vote).
- Code: `src/server/judge-votes.ts` (`castJudgeVote`),
  `src/lib/voting.ts` (`tallyVotes` — sums judge votes into the same tally).

---

## Betting on the Jockey

### The moment your team loses a battle, you become a scout. You can bet your personal bankroll on matchups in other pods (and later, across the full bracket).

- Participant view: [`/betting`](https://vibeathon-alpha.vercel.app/betting) — lists every
  open battle, shows live pools, exposes the bet form.
- Organizer overview of pools: [`/admin/betting`](https://vibeathon-alpha.vercel.app/admin/betting).
- Code: `src/server/bets.ts` (`placeBet`, `closeBetting`,
  `settleBetsForBattle`), `src/lib/bankroll.ts` (`settleParimutuel`, `canBet`,
  `maxAllowedBet`).

### Parimutuel pool: all bets on a matchup form two pools. When the battle resolves, the losing pool is distributed to winners proportionally.

- Implemented as floor-per-winner with leftover sweep to the largest winner
  (keeps the total conserved).
- `bankroll_ledger.kind = 'bet_payout'` rows record settlement deltas per
  bettor; visible in the participant's [`/history`](https://vibeathon-alpha.vercel.app/history).
- Code: `src/lib/bankroll.ts` (`settleParimutuel`).

### You CAN bet on your own team. You know them best.

- Formal spec (§10) excludes the **current matchup**, which the code enforces
  in `canBet`. The UI copy matches — you can't place a bet on a matchup your
  own team is in.
- Code: `src/lib/bankroll.ts` (`canBet` — "current matchup" check).

### You CANNOT bet on your direct opponent or on matchups involving the team that just eliminated you.

- Enforced in `canBet` using `participants.eliminatedByTeamId`. Also enforces
  "lineage-broken" — you can't bet while you are still on your R1 lineage.
- Code: `src/lib/bankroll.ts` (`canBet`), `src/server/battles.ts`
  (eliminated-by tracking in `resolveWithWinner`).

### Betting closes halfway through each round. No waiting for the demo. Commit on early momentum.

- `bettingClosesAt` is stamped on each `battles` row at start time. `canBet`
  short-circuits once `now >= bettingClosesAt`.
- Organizer can override the close time per battle:
  [`/admin/timing`](https://vibeathon-alpha.vercel.app/admin/timing), or lock bets
  immediately via a per-row button on
  [`/admin/battles`](https://vibeathon-alpha.vercel.app/admin/battles) ("Lock bets").
- Code: `src/lib/time.ts` (`bettingClosesAt`), `src/server/battles.ts`
  (`startBattle` — stamps close time), `src/server/bets.ts`
  (`closeBetting`).

### Min bet: 10 ₿. Max per matchup: 50% of your personal bankroll.

- Constants `MIN_BET = 10`, `MAX_BET_FRACTION = 0.5` enforced at
  `placeBet` time, and the participant UI caps the slider at `maxAllowedBet`.
- Code: `src/lib/bankroll.ts` (constants + `maxAllowedBet`),
  `src/server/bets.ts` (`placeBet` — validation), `src/app/(app)/betting/`
  (UI).

---

## Prizes

| Prize                  | Amount       | Goes to                                                                 |
|------------------------|--------------|-------------------------------------------------------------------------|
| Grand Champion Founder | ৳140,000     | The only Traveller who never lost.                                      |
| Runner-Up Founder      | ৳80,000      | Captain of the losing Final team.                                       |
| Top Scout              | ৳50,000      | Largest % bankroll growth from betting.                                 |
| Best Coach             | ৳10,000      | Judges' choice, informed by your nominations.                           |
| Participation Floor    | ৳200 each    | Everyone walks away with something.                                     |

- Participant view of the prize table: [`/prizes`](https://vibeathon-alpha.vercel.app/prizes).
- Organizer finalizes + exports:
  [`/admin/settlement`](https://vibeathon-alpha.vercel.app/admin/settlement).
- Code: `src/server/settlement.ts` (`computeSettlement` — emits a row per
  Traveller with prize attribution, including `bestCoachParticipantId` from
  judge input; `settlementToCsv` for export).

### Nominate your coach.

- Participant UI: [`/nominate`](https://vibeathon-alpha.vercel.app/nominate) — pick up to
  three Travellers, write a reason each. Nominations are private.
- Judge aggregation view: [`/judge/coaches`](https://vibeathon-alpha.vercel.app/judge/coaches).
- Code: `src/db/schema.ts` (`coachNominations` table — unique per
  `(nominatorId, nomineeId)`), server actions in `src/app/actions.ts`
  (`nominateCoachAction`), judge tools in `src/app/(app)/judge/coaches/`.

---

## The Traveler Test

### Before Round 1 begins, look at your project. Ask yourself: "If the Traveler were sitting next to me right now, would they be glad I built this?"

- Surfaced permanently on the participant dashboard:
  [`/`](https://vibeathon-alpha.vercel.app/) — right-hand panel. Same question is the
  marquee slogan on
  [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) and the spectator screen
  [`/spectator`](https://vibeathon-alpha.vercel.app/spectator).

---

## A Few Things To Remember

1. **Battles are fun.** Loser joins the winner in the next round — enforced by
   the transfer loop in
   `src/server/battles.ts` (`resolveWithWinner`). Visible to participants on
   [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) when the new round starts.
2. **Late rounds are about leadership, not coding alone.** Team size is
   tracked via `team_members` and shown on the "My team" panel of
   [`/matchup`](https://vibeathon-alpha.vercel.app/matchup). By QF, 8 names; SF, 16;
   Final, 32.
3. **Ideas compound, not people.** The winning idea's team absorbs the losing
   Traveller; see [`/bracket`](https://vibeathon-alpha.vercel.app/bracket) to watch the
   lineage propagate.
4. **You only get one shot.** Battles are write-once — admin reversal exists
   but is rate-limited and audited. Reversal tooling lives at
   [`/admin/overrides`](https://vibeathon-alpha.vercel.app/admin/overrides). Code:
   `src/server/battles.ts` (`reverseResolution`).

---

## Fast Admin Index

| Task | URL |
|---|---|
| Landing / overview | [`/admin`](https://vibeathon-alpha.vercel.app/admin) |
| Live vote feed (wall display) | [`/admin/voting-booth`](https://vibeathon-alpha.vercel.app/admin/voting-booth) |
| Pods + R1 seeding | [`/admin/pods`](https://vibeathon-alpha.vercel.app/admin/pods) |
| Roster (add phantoms, remove users) | [`/admin/travellers`](https://vibeathon-alpha.vercel.app/admin/travellers) |
| Battle control (start / lock / DQ) | [`/admin/battles`](https://vibeathon-alpha.vercel.app/admin/battles) |
| Play-in round (>64 overflow) | [`/admin/play-in`](https://vibeathon-alpha.vercel.app/admin/play-in) |
| Bet pools | [`/admin/betting`](https://vibeathon-alpha.vercel.app/admin/betting) |
| Timing / round schedule | [`/admin/timing`](https://vibeathon-alpha.vercel.app/admin/timing) |
| Ad-hoc overrides + reversals | [`/admin/overrides`](https://vibeathon-alpha.vercel.app/admin/overrides) |
| Settlement + CSV export | [`/admin/settlement`](https://vibeathon-alpha.vercel.app/admin/settlement) |
| Per-participant bankroll | [`/admin/bankroll`](https://vibeathon-alpha.vercel.app/admin/bankroll) |
| Money-conservation audit | [`/admin/audit`](https://vibeathon-alpha.vercel.app/admin/audit) |

## Fast Participant Index

| Task | URL |
|---|---|
| Dashboard (bankroll + ledger) | [`/`](https://vibeathon-alpha.vercel.app/) |
| My matchup + vote | [`/matchup`](https://vibeathon-alpha.vercel.app/matchup) |
| Full bracket | [`/bracket`](https://vibeathon-alpha.vercel.app/bracket) |
| Place / review bets | [`/betting`](https://vibeathon-alpha.vercel.app/betting) |
| Personal ledger | [`/history`](https://vibeathon-alpha.vercel.app/history) |
| Nominate a coach | [`/nominate`](https://vibeathon-alpha.vercel.app/nominate) |
| Prize catalogue | [`/prizes`](https://vibeathon-alpha.vercel.app/prizes) |
| Spectator wall | [`/spectator`](https://vibeathon-alpha.vercel.app/spectator) |

## Fast Judge Index

| Task | URL |
|---|---|
| Landing | [`/judge`](https://vibeathon-alpha.vercel.app/judge) |
| Deadlock resolution | [`/judge/deadlocks`](https://vibeathon-alpha.vercel.app/judge/deadlocks) |
| SF / Final votes | [`/judge/vote`](https://vibeathon-alpha.vercel.app/judge/vote) |
| Best-Coach review | [`/judge/coaches`](https://vibeathon-alpha.vercel.app/judge/coaches) |

---

## Source Code Hot-Spots

- Pure math — `src/lib/`
  - `bankroll.ts` — 80/20 split, parimutuel, `canBet`, `maxAllowedBet`.
  - `voting.ts` — tally + consensus evaluation.
  - `seeding.ts` — pod snake-draft + R1 pairing.
  - `pairing.ts` — play-in junior/senior pairing.
  - `round-advance.ts` — R1→R2/R3/QF/SF/Final bracket logic.
  - `time.ts` — round durations, `bettingClosesAt`, timezone helpers.
- Server logic — `src/server/`
  - `pods.ts`, `battles.ts`, `bets.ts`, `playin.ts`, `settlement.ts`.
  - `voting-booth.ts` — powers the live feed.
  - `travellers.ts` — phantom +/-, hard remove.
  - `overrides.ts` — organizer-only adjustments.
- Persistence — `src/db/schema.ts` (single source of truth for Drizzle tables,
  enums, JSON shapes).
- Tests — `src/lib/*.test.ts` (Vitest, 22 tests, runs via `pnpm test`).

---

## Known Gaps (rules vs. product)

Keep these in mind when walking people through the app:

1. **Losing captain "share with teammates" is not a flow.** The captain's 20%
   sits in their `personalBankroll`. There is no UI for voluntary
   redistribution; the only workaround is organizer bankroll adjustments at
   [`/admin/overrides`](https://vibeathon-alpha.vercel.app/admin/overrides).
2. **No post-battle resolution screen.** The 80/20 split is correct in the
   ledger but participants have no "here's what just happened" moment. They
   see the delta in their ledger on [`/`](https://vibeathon-alpha.vercel.app/).
3. **No "at-risk" badge on `/matchup` pre-resolve.** Team pots are shown as
   numbers but not as stakes.
4. **Pot size per bracket node is shown, but not on a per-round history
   basis.** The bracket view on
   [`/bracket`](https://vibeathon-alpha.vercel.app/bracket) shows current pots; historical
   pot evolution per team requires querying `bankroll_ledger` directly.

These are opportunities, not bugs — every rule the doc calls out is enforced
somewhere in code; only the *explanation* of those rules is light inside the
product.
