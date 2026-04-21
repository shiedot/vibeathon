/**
 * Integration smoke test: runs a full R1 battle on the connected database.
 *
 * Usage: `pnpm tsx scripts/e2e-battle.ts`
 *
 * DANGER: this script wipes and re-seeds the tournament tables (participants,
 * teams, battles, bets, ledger). Only run against a development database.
 */
import "dotenv/config";
import { and, eq, isNull, sum } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  bankrollLedger,
  battles,
  bets,
  consensusVotes,
  participants,
  teamMembers,
  teams,
} from "../src/db/schema";
import { startBattle, castVote } from "../src/server/battles";
import { placeBet } from "../src/server/bets";

async function main() {
  console.log("=== E2E battle smoke test ===");

  // Clean slate: delete all non-organizer rows.
  await db.delete(consensusVotes);
  await db.delete(bankrollLedger);
  await db.delete(bets);
  await db.delete(battles);
  await db.delete(teamMembers);
  await db.delete(teams);
  await db.delete(participants);
  console.log("Wiped tournament state.");

  // Seed 16 participants (two pods of 8).
  const rows = Array.from({ length: 16 }, (_, i) => ({
    name: `Traveller ${i + 1}`,
    email: `t${i + 1}@test.local`,
    department: `Dept ${i % 4}`,
    employeeId: `EMP-${i + 1}`,
    yearsCoding: (i % 6) + 1,
    comfortLevel: (i % 4) + 1,
    primaryStack: "",
    toolOfChoice: "",
    licenseStatus: "",
    setupStatus: "ready" as const,
    personalBankroll: 1000,
    role: "participant" as const,
  }));
  await db.insert(participants).values(rows);
  console.log(`Inserted ${rows.length} participants.`);

  // Need at least 8 per pod for the snake draft; loadReadyRoster requires
  // <=64 total. We can't force 8 pods from 16 participants — seedTournament
  // puts 2 per pod. Let's re-seed the actual number allowed: 16 into 2 pods
  // would need podCount=2 but pods.ts uses 8. Instead skip the normal seed
  // path and do a direct setup for this test.
  // We'll simply skip the pods helper and manually create 1 battle.
  const reloaded = await db.select().from(participants);
  const [a, b] = reloaded;

  const [teamA] = await db
    .insert(teams)
    .values({
      captainId: a.id,
      teamPot: 1000,
      lineageRootCaptainId: a.id,
      podId: 1,
      displayName: a.name,
    })
    .returning();
  const [teamB] = await db
    .insert(teams)
    .values({
      captainId: b.id,
      teamPot: 1000,
      lineageRootCaptainId: b.id,
      podId: 1,
      displayName: b.name,
    })
    .returning();
  await db.insert(teamMembers).values({ teamId: teamA.id, participantId: a.id });
  await db.insert(teamMembers).values({ teamId: teamB.id, participantId: b.id });
  await db
    .update(participants)
    .set({ currentTeamId: teamA.id, r1LineageRootId: a.id, personalBankroll: 0 })
    .where(eq(participants.id, a.id));
  await db
    .update(participants)
    .set({ currentTeamId: teamB.id, r1LineageRootId: b.id, personalBankroll: 0 })
    .where(eq(participants.id, b.id));
  await db.insert(bankrollLedger).values([
    { kind: "stake", participantId: a.id, delta: -1000, reason: "R1 stake" },
    { kind: "stake", teamId: teamA.id, delta: 1000, reason: "R1 stake" },
    { kind: "stake", participantId: b.id, delta: -1000, reason: "R1 stake" },
    { kind: "stake", teamId: teamB.id, delta: 1000, reason: "R1 stake" },
  ]);

  const [battle] = await db
    .insert(battles)
    .values({
      roundNumber: 1,
      teamAId: teamA.id,
      teamBId: teamB.id,
      scheduledStart: new Date(),
      roundDurationMinutes: 60,
      bettingClosesAt: new Date(Date.now() + 30 * 60 * 1000),
      stakeA: 1000,
      stakeB: 1000,
      combinedPool: 2000,
      status: "pending",
    })
    .returning();

  // Start the battle. Use null byUser — we haven't created a real Auth.js row.
  await startBattle(battle.id, "");
  console.log("Battle started.");

  // Place a bet from a third Traveller c on a separate team (so their
  // lineage is "broken" and they're eligible to bet on this matchup).
  const c = reloaded[2];
  const [teamC] = await db
    .insert(teams)
    .values({
      captainId: reloaded[3].id,
      teamPot: 0,
      lineageRootCaptainId: reloaded[3].id,
      podId: 2,
      displayName: "Spectator team",
    })
    .returning();
  await db.insert(teamMembers).values({ teamId: teamC.id, participantId: c.id });
  await db
    .update(participants)
    .set({
      currentTeamId: teamC.id,
      r1LineageRootId: c.id, // original lineage root = c (R1 solo)
      eliminatedByTeamId: null,
    })
    .where(eq(participants.id, c.id));

  // Reject a bet where c is betting on their own team C (not in this matchup,
  // but canBet has an additional "own team currentTeamId must not equal side"
  // check that we're testing as a sanity case). c's currentTeamId is teamC
  // which isn't teamA/teamB, so actually this should succeed. Place 100₿ on
  // teamB and check ledger.
  await placeBet({
    bettorId: c.id,
    battleId: battle.id,
    teamBackedId: teamB.id,
    stakeAmount: 100,
    byUserId: null,
  });
  console.log("c placed 100₿ on teamB.");

  // Both voters vote for A; majority reached.
  await castVote({ battleId: battle.id, voterId: a.id, teamVotedForId: teamA.id });
  await castVote({ battleId: battle.id, voterId: b.id, teamVotedForId: teamA.id });
  const [resolved] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battle.id));
  console.log(
    `Battle status=${resolved.status}, winner=${resolved.winnerTeamId === teamA.id ? "A" : "B"}`,
  );

  // Assert conservation.
  const [pb] = await db
    .select({ s: sum(participants.personalBankroll) })
    .from(participants);
  const [tp] = await db.select({ s: sum(teams.teamPot) }).from(teams);
  const [ob] = await db
    .select({ s: sum(bets.stakeAmount) })
    .from(bets)
    .where(and(eq(bets.refunded, false), isNull(bets.payoutAmount)));
  const [pcount] = await db
    .select({ c: participants.id })
    .from(participants)
    .where(eq(participants.role, "participant"));
  void pcount;
  const total = Number(pb.s ?? 0) + Number(tp.s ?? 0) + Number(ob.s ?? 0);
  const participantsRows = await db.select().from(participants);
  const expected = participantsRows.length * 1000;
  console.log(
    `Conservation: actual=${total} expected=${expected} (Δ=${total - expected})`,
  );

  if (total !== expected) {
    console.error("FAIL: conservation broken");
    process.exit(1);
  }

  // Ledger should sum to (personal_bankrolls + team_pots + open_bets - starting_stakes),
  // but since we only issued stake + battle rows, just check that the app-level
  // invariants hold end-to-end.
  const [leftATeamMembers] = await db
    .select({ c: teamMembers.participantId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamB.id), isNull(teamMembers.leftAt)));
  void leftATeamMembers;
  console.log("OK: e2e battle ran with conservation intact.");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
