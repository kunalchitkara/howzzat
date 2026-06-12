import { WALLET_TOP_UP_AMOUNTS_PENCE } from "@howzzat/shared";
import { ApiError } from "../api/http";
import { prisma } from "../db";
import { appOrigin, getStripe } from "../stripe/client";
import { creditTournamentWallet } from "./tournament-billing";
import { getTournament } from "./tournaments";
import { isTournamentManager } from "./tournament-access";
import { userHasOrgRole } from "../auth/request";
import type { AuthUser } from "../auth/session";

const TOP_UP_SET = new Set<number>(WALLET_TOP_UP_AMOUNTS_PENCE);

export async function assertCanTopUpWallet(
  tournamentId: string,
  user: AuthUser,
): Promise<void> {
  const tournament = await getTournament(tournamentId);
  const isManager = await isTournamentManager(tournamentId, user.id);
  const isOrgAdmin = userHasOrgRole(user, tournament.organizationId, [
    "OWNER",
    "MANAGER",
  ]);
  if (!isManager && !isOrgAdmin) {
    throw new ApiError(
      403,
      "Only tournament managers can top up the wallet",
      "WALLET_FORBIDDEN",
    );
  }
}

export async function createWalletCheckoutSession(
  tournamentId: string,
  amountPence: number,
  userId: string,
  returnToWallet = false,
) {
  if (!TOP_UP_SET.has(amountPence)) {
    throw new ApiError(
      400,
      "Top-up must be £10, £20, or £50",
      "INVALID_TOP_UP_AMOUNT",
    );
  }

  const tournament = await getTournament(tournamentId);
  const topUp = await prisma.walletTopUp.create({
    data: {
      tournamentId,
      amountPence,
      paidByUserId: userId,
      status: "PENDING",
    },
  });

  const origin = appOrigin();
  const basePath = `${origin}/dashboard/organizations/${tournament.organizationId}/tournaments/${tournamentId}`;
  const returnPath = returnToWallet ? `${basePath}/wallet` : basePath;
  const successUrl = `${returnPath}?wallet=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${returnPath}?wallet=cancelled`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amountPence,
          product_data: {
            name: `${tournament.name} wallet top-up`,
            description: "Howzzat tournament scoring wallet",
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      tournamentId,
      topUpId: topUp.id,
      amountPence: String(amountPence),
    },
  });

  await prisma.walletTopUp.update({
    where: { id: topUp.id },
    data: { stripePaymentId: session.id },
  });

  return { sessionId: session.id, url: session.url };
}

export async function completeWalletCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    throw new ApiError(400, "Payment not completed", "PAYMENT_INCOMPLETE");
  }

  const tournamentId = session.metadata?.tournamentId;
  const topUpId = session.metadata?.topUpId;
  const amountPence = Number(session.metadata?.amountPence ?? 0);

  if (!tournamentId || !topUpId || !amountPence) {
    throw new ApiError(400, "Invalid checkout session", "INVALID_SESSION");
  }

  const topUp = await prisma.walletTopUp.findUnique({ where: { id: topUpId } });
  if (!topUp) {
    throw new ApiError(404, "Top-up not found", "TOP_UP_NOT_FOUND");
  }
  if (topUp.status === "COMPLETED") {
    return prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  }

  await creditTournamentWallet(tournamentId, amountPence, topUpId);
  return prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
}

export async function handleStripeWebhook(rawBody: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new ApiError(503, "Stripe webhook not configured", "WEBHOOK_NOT_CONFIGURED");
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new ApiError(400, "Invalid Stripe signature", "WEBHOOK_SIGNATURE_INVALID");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid" && session.metadata?.topUpId) {
      await completeWalletCheckoutSession(session.id);
    }
  }

  return { received: true };
}
