import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { signInWithGoogleProfile, verifyGoogleIdToken } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  idToken: z.string().min(1),
});

/** Mobile / native: exchange a Google ID token for a Howzzat session token. */
export const POST = withApi(async (request) => {
  const { idToken } = await parseJson(request, bodySchema);
  const profile = await verifyGoogleIdToken(idToken);
  const user = await signInWithGoogleProfile(profile);
  const session = await createSession(user.id);

  return json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      sessionToken: session.token,
      expiresAt: session.expiresAt.toISOString(),
    },
  });
});
