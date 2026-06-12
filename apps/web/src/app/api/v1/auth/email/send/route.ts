import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { sendEmailVerification } from "@/lib/auth/resend-verify";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
});

export const POST = withApi(async (request) => {
  const { email } = await parseJson(request, bodySchema);
  await sendEmailVerification(email);

  return json({
    data: {
      sent: true,
      email: email.toLowerCase().trim(),
    },
  });
});
