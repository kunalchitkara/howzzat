import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import {
  assertCanTopUpWallet,
  completeWalletCheckoutSession,
} from "@/lib/services/wallet-stripe";

export const runtime = "nodejs";

/** Confirm a completed Checkout session (local dev fallback when webhook is not running). */
export const POST = withApi(async (request, { params }) => {
  const { tournamentId } = await params;
  const user = await requireRequestUser(request);
  await assertCanTopUpWallet(tournamentId, user);

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return json({ error: "session_id required" }, 400);
  }

  const tournament = await completeWalletCheckoutSession(sessionId);
  if (tournament.id !== tournamentId) {
    return json({ error: "Session does not match tournament" }, 400);
  }

  return json({
    data: {
      balancePence: tournament.balancePence,
    },
  });
});
