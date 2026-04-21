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
  type CommitMatchup,
} from "@/server/pods";
import {
  addPhantomTravellers,
  hardRemoveParticipant,
  listTravellers,
  removeLastPhantomTraveller,
  type TravellerRow,
} from "@/server/travellers";
import {
  commitPlayIn,
  previewPlayIn,
  resolvePlayIn,
} from "@/server/playin";
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

export async function previewPodsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof previewPods>>>
> {
  return run(async () => {
    await requireOrganizer();
    return await previewPods();
  });
}

export async function commitPodsAction(
  matchups: CommitMatchup[],
  startAtIso: string,
): Promise<ActionResult<{ teamsCreated: number; battlesCreated: number }>> {
  return run(async () => {
    const me = await requireOrganizer();
    const res = await commitPodsAndR1({
      matchups,
      scheduledStart: new Date(startAtIso),
      byUserId: me.userId,
    });
    revalidatePath("/admin/pods");
    revalidatePath("/admin/battles");
    revalidatePath("/bracket");
    return res;
  });
}

export async function addPhantomTravellersAction(
  n: number,
): Promise<ActionResult<{ added: number }>> {
  return run(async () => {
    await requireOrganizer();
    const added = await addPhantomTravellers(n);
    revalidatePath("/admin");
    revalidatePath("/admin/pods");
    revalidatePath("/admin/travellers");
    return { added };
  });
}

export async function removeLastPhantomAction(): Promise<
  ActionResult<{
    removed: { removedId: string; removedName: string } | null;
  }>
> {
  return run(async () => {
    await requireOrganizer();
    const removed = await removeLastPhantomTraveller();
    revalidatePath("/admin");
    revalidatePath("/admin/pods");
    revalidatePath("/admin/travellers");
    return { removed };
  });
}

export async function removeTravellerAction(
  participantId: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    await requireOrganizer();
    await hardRemoveParticipant(participantId);
    revalidatePath("/admin");
    revalidatePath("/admin/pods");
    revalidatePath("/admin/travellers");
  });
}

export async function listTravellersAction(): Promise<
  ActionResult<TravellerRow[]>
> {
  return run(async () => {
    await requireOrganizer();
    return await listTravellers();
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
    revalidatePath("/admin");
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

