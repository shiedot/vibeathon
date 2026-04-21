"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/server/current-participant";
import {
  judgeDecide,
  startBattle,
  startRound,
} from "@/server/battles";
import { closeBetting } from "@/server/bets";
import {
  commitPodsAndR1,
  previewPods,
  resetTournamentState,
} from "@/server/pods";
import {
  commitPlayIn,
  previewPlayIn,
  resolvePlayIn,
} from "@/server/playin";
import { ingestRosterCsv } from "@/server/ingest";
import {
  adjustBankroll,
  adjustTeamPot,
  forceResolveBattle,
  moveParticipantToTeam,
  refundBetOverride,
  regenerateRoundMatchups,
  reverseBattle,
  setParticipantRole,
  updateBettingClosesAt,
} from "@/server/overrides";
import {
  commitSettlement,
  computeSettlement,
  settlementToCsv,
  type SettlementRow,
} from "@/server/settlement";
import { run, type ActionResult } from "@/server/action-result";
import { db } from "@/db/client";
import { eq, sql } from "drizzle-orm";
import { participants } from "@/db/schema";

export async function ingestCsvAction(
  csv: string,
): Promise<ActionResult<{ inserted: number; updated: number; errors: { row: number; message: string }[] }>> {
  return run(async () => {
    await requireOrganizer();
    const result = await ingestRosterCsv(csv);
    revalidatePath("/admin/roster");
    return result;
  });
}

export async function setSetupStatusAction(
  participantId: string,
  status: "incomplete" | "pending_review" | "ready",
): Promise<ActionResult<void>> {
  return run(async () => {
    await requireOrganizer();
    await db
      .update(participants)
      .set({ setupStatus: status })
      .where(eq(participants.id, participantId));
    revalidatePath("/admin/roster");
  });
}

export async function previewPodsAction(
  seed: number,
): Promise<ActionResult<Awaited<ReturnType<typeof previewPods>>>> {
  return run(async () => {
    await requireOrganizer();
    return await previewPods(seed);
  });
}

export async function commitPodsAction(
  seed: number,
  startAtIso: string,
): Promise<ActionResult<{ teamsCreated: number; battlesCreated: number }>> {
  return run(async () => {
    const me = await requireOrganizer();
    const res = await commitPodsAndR1({
      seed,
      scheduledStart: new Date(startAtIso),
      byUserId: me.userId,
    });
    revalidatePath("/admin/pods");
    revalidatePath("/admin/battles");
    revalidatePath("/bracket");
    return res;
  });
}

export async function resetTournamentAction(): Promise<ActionResult<void>> {
  return run(async () => {
    await requireOrganizer();
    await resetTournamentState();
    revalidatePath("/admin/pods");
    revalidatePath("/admin/battles");
    revalidatePath("/bracket");
  });
}

export async function previewPlayInAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof previewPlayIn>>>
> {
  return run(async () => {
    await requireOrganizer();
    return await previewPlayIn();
  });
}

export async function commitPlayInAction(
  startAtIso: string,
): Promise<ActionResult<{ battlesCreated: number }>> {
  return run(async () => {
    const me = await requireOrganizer();
    return await commitPlayIn({
      scheduledStart: new Date(startAtIso),
      byUserId: me.userId,
    });
  });
}

export async function resolvePlayInAction(
  battleId: string,
  winnerParticipantId: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await resolvePlayIn(battleId, winnerParticipantId, me.userId);
    revalidatePath("/admin/play-in");
  });
}

export async function startBattleAction(battleId: string): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await startBattle(battleId, me.userId);
    revalidatePath("/admin/battles");
  });
}

export async function startRoundAction(
  round: number,
): Promise<ActionResult<{ started: number }>> {
  return run(async () => {
    const me = await requireOrganizer();
    return await startRound(round, me.userId);
  });
}

export async function closeBettingAction(
  battleId: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    await requireOrganizer();
    await closeBetting(battleId);
  });
}

export async function judgeDecideAction(
  input: {
    battleId: string;
    outcome: "pickWinner" | "flipCoin" | "dqBoth";
    winnerTeamId?: string;
    note: string;
  },
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await judgeDecide({ ...input, byUserId: me.userId });
    revalidatePath("/judge/deadlocks");
  });
}

export async function forceResolveAction(
  battleId: string,
  winnerTeamId: string,
  reason: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await forceResolveBattle({
      battleId,
      winnerTeamId,
      reason,
      byUserId: me.userId,
    });
    revalidatePath("/admin/overrides");
  });
}

export async function reverseBattleAction(
  battleId: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await reverseBattle({ battleId, byUserId: me.userId });
    revalidatePath("/admin/overrides");
  });
}

export async function adjustBankrollAction(opts: {
  participantId: string;
  delta: number;
  reason: string;
}): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await adjustBankroll({ ...opts, byUserId: me.userId });
    revalidatePath("/admin/overrides");
  });
}

export async function adjustTeamPotAction(opts: {
  teamId: string;
  delta: number;
  reason: string;
}): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await adjustTeamPot({ ...opts, byUserId: me.userId });
    revalidatePath("/admin/overrides");
  });
}

export async function moveParticipantAction(opts: {
  participantId: string;
  teamId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await moveParticipantToTeam({ ...opts, byUserId: me.userId });
    revalidatePath("/admin/overrides");
  });
}

export async function refundBetAction(
  betId: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await refundBetOverride({ betId, byUserId: me.userId });
    revalidatePath("/admin/overrides");
  });
}

export async function setRoleAction(
  participantId: string,
  role: "participant" | "organizer" | "judge",
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await setParticipantRole({ participantId, role, byUserId: me.userId });
    revalidatePath("/admin/roster");
  });
}

export async function updateBettingClosesAtAction(
  battleId: string,
  atIso: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await updateBettingClosesAt({
      battleId,
      at: new Date(atIso),
      byUserId: me.userId,
    });
    revalidatePath("/admin/timing");
  });
}

export async function regenerateRoundAction(
  round: number,
): Promise<ActionResult<void>> {
  return run(async () => {
    const me = await requireOrganizer();
    await regenerateRoundMatchups({ round, byUserId: me.userId });
    revalidatePath("/admin/overrides");
  });
}

export async function previewSettlementAction(opts: {
  bestCoachParticipantId?: string | null;
}): Promise<ActionResult<SettlementRow[]>> {
  return run(async () => {
    await requireOrganizer();
    return await computeSettlement(opts);
  });
}

export async function commitSettlementAction(opts: {
  bestCoachParticipantId?: string | null;
}): Promise<ActionResult<SettlementRow[]>> {
  return run(async () => {
    await requireOrganizer();
    const rows = await commitSettlement(opts);
    revalidatePath("/admin/settlement");
    revalidatePath("/prizes");
    return rows;
  });
}

export async function settlementCsvAction(opts: {
  bestCoachParticipantId?: string | null;
}): Promise<ActionResult<string>> {
  return run(async () => {
    await requireOrganizer();
    const rows = await computeSettlement(opts);
    return settlementToCsv(rows);
  });
}

// Small utility action so the admin overview can request a bulk mark-all-ready.
export async function markAllReadyAction(): Promise<
  ActionResult<{ count: number }>
> {
  return run(async () => {
    await requireOrganizer();
    const res = await db
      .update(participants)
      .set({ setupStatus: "ready" })
      .where(sql`${participants.role} = 'participant' AND ${participants.setupStatus} != 'ready'`)
      .returning({ id: participants.id });
    revalidatePath("/admin/roster");
    return { count: res.length };
  });
}
