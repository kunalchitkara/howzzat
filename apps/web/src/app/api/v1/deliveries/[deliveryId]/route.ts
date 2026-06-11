import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { updateDeliverySchema } from "@/lib/validations";
import { updateDelivery } from "@/lib/services/matches";

export const runtime = "nodejs";

export const PATCH = withApi(async (request, { params }) => {
  const { deliveryId } = await params;
  const input = await parseJson(request, updateDeliverySchema);
  const result = await updateDelivery(deliveryId, input);
  return json({ data: result });
});
