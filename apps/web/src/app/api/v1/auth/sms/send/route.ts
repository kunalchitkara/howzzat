import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { normalizeUkPhone } from "@/lib/auth/phone";
import { sendSmsVerification } from "@/lib/auth/twilio-verify";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(10).max(20),
});

export const POST = withApi(async (request) => {
  const { phone } = await parseJson(request, bodySchema);
  const e164 = normalizeUkPhone(phone);
  await sendSmsVerification(e164);

  return json({
    data: {
      sent: true,
      phone: e164,
    },
  });
});
