import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { createDeliverySchema } from "@/lib/validations";
import { recordDelivery } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (request) => {
  const input = await parseJson(request, createDeliverySchema);
  const result = await recordDelivery(input);
  return json({ data: result }, 201);
});
