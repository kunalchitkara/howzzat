import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import {
  assertCanTopUpWallet,
  createWalletCheckoutSession,
} from "@/lib/services/wallet-stripe";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountPence: z.number().int().positive(),
});

export const POST = withApi(async (request, { params }) => {
  const { tournamentId } = await params;
  const user = await requireRequestUser(request);
  await assertCanTopUpWallet(tournamentId, user);

  const { amountPence } = await parseJson(request, bodySchema);
  const session = await createWalletCheckoutSession(
    tournamentId,
    amountPence,
    user.id,
  );

  return json({ data: session }, 201);
});
