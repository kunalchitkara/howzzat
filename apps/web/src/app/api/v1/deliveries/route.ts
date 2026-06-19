import { ApiError, json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRequestUser } from "@/lib/auth/request";
import { createDeliverySchema } from "@/lib/validations";
import { recordDelivery } from "@/lib/services/matches";
import { prisma } from "@/lib/db";
import { assertCanMutateScoring } from "@/lib/services/scoring-lock";

export const runtime = "nodejs";

export const POST = withApi(async (request) => {
  const input = await parseJson(request, createDeliverySchema);
  const user = await getRequestUser(request);
  const innings = await prisma.innings.findUnique({
    where: { id: input.inningsId },
    select: { matchId: true },
  });
  if (!innings) {
    throw new ApiError(404, "Innings not found", "INNINGS_NOT_FOUND");
  }
  await assertCanMutateScoring(innings.matchId, user);
  const result = await recordDelivery(input);
  return json({ data: result.slim }, 201);
});
