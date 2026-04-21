"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireJudge } from "@/server/current-participant";
import { castJudgeVote } from "@/server/judge-votes";
import { run, type ActionResult } from "@/server/action-result";

const Input = z.object({
  battleId: z.string().uuid(),
  teamVotedFor: z.string().uuid(),
});

export async function judgeVoteAction(
  raw: z.infer<typeof Input>,
): Promise<ActionResult<void>> {
  const input = Input.parse(raw);
  return run(async () => {
    const me = await requireJudge();
    await castJudgeVote({
      battleId: input.battleId,
      judgeParticipantId: me.participant.id,
      teamVotedFor: input.teamVotedFor,
    });
    revalidatePath("/judge/vote");
  });
}
