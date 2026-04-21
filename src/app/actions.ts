"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizer, requireParticipant } from "@/server/current-participant";
import { castVote } from "@/server/battles";
import { placeBet } from "@/server/bets";
import { nominateCoach } from "@/server/nominations";
import { run, type ActionResult } from "@/server/action-result";

const VoteInput = z.object({
  battleId: z.string().uuid(),
  teamVotedForId: z.string().uuid(),
});

export async function castVoteAction(
  raw: z.infer<typeof VoteInput>,
): Promise<ActionResult<void>> {
  const input = VoteInput.parse(raw);
  return run(async () => {
    const me = await requireParticipant();
    await castVote({
      battleId: input.battleId,
      voterId: me.participant.id,
      teamVotedForId: input.teamVotedForId,
    });
    revalidatePath("/matchup");
    revalidatePath("/");
  });
}

const BetInput = z.object({
  battleId: z.string().uuid(),
  teamBackedId: z.string().uuid(),
  stakeAmount: z.number().int().positive(),
});

export async function placeBetAction(
  raw: z.infer<typeof BetInput>,
): Promise<ActionResult<{ betId: string }>> {
  const input = BetInput.parse(raw);
  return run(async () => {
    const me = await requireParticipant();
    const res = await placeBet({
      bettorId: me.participant.id,
      battleId: input.battleId,
      teamBackedId: input.teamBackedId,
      stakeAmount: input.stakeAmount,
      byUserId: me.userId,
    });
    revalidatePath("/betting");
    revalidatePath("/");
    return res;
  });
}

const NominateInput = z.object({
  nomineeId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export async function nominateCoachAction(
  raw: z.infer<typeof NominateInput>,
): Promise<ActionResult<void>> {
  const input = NominateInput.parse(raw);
  return run(async () => {
    const me = await requireParticipant();
    await nominateCoach({
      nominatorId: me.participant.id,
      nomineeId: input.nomineeId,
      reason: input.reason,
    });
    revalidatePath("/nominate");
  });
}

// Organizer-only action: signal in UI that the caller is an organizer.
// Keeps the contract explicit for client components calling this.
export async function verifyOrganizer(): Promise<
  ActionResult<{ participantId: string }>
> {
  return run(async () => {
    const me = await requireOrganizer();
    return { participantId: me.participant.id };
  });
}
