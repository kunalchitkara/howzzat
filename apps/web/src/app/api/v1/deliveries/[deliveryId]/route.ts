import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRequestUser } from "@/lib/auth/request";
import { updateDeliverySchema } from "@/lib/validations";
import { updateDelivery } from "@/lib/services/matches";
import { prisma } from "@/lib/db";
import { assertCanMutateScoring } from "@/lib/services/scoring-lock";

export const runtime = "nodejs";

export const PATCH = withApi(async (request, { params }) => {
  const { deliveryId } = await params;
  const input = await parseJson(request, updateDeliverySchema);
  const user = await getRequestUser(request);
  const row = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { innings: { select: { matchId: true } } },
  });
  if (row) {
    await assertCanMutateScoring(row.innings.matchId, user);
  }
  const result = await updateDelivery(deliveryId, input);
  return json({ data: result });
});
