import {
  DEFAULT_FEE_PER_PLAYER_PENCE,
  hasMinimumScoringBalance,
  matchChargePence,
} from "@howzzat/shared";
import { ApiError } from "../api/http";
import { prisma } from "../db";
import { getMatch } from "./matches";
import { getTournament } from "./tournaments";

export function resolveFeePerPlayerPence(tournament: {
  feeOverridePence: number | null;
}): number {
  return tournament.feeOverridePence ?? DEFAULT_FEE_PER_PLAYER_PENCE;
}

export function isTournamentBillingWaived(tournament: {
  billingFreeUntil: Date | null;
}): boolean {
  if (!tournament.billingFreeUntil) return false;
  return new Date() < tournament.billingFreeUntil;
}

/** Gate before scoring starts — fixed £2.50 floor, independent of squad size. */
export function assertTournamentCanStartScoring(tournament: {
  balancePence: number;
  billingFreeUntil: Date | null;
}): void {
  if (isTournamentBillingWaived(tournament)) return;
  if (!hasMinimumScoringBalance(tournament.balancePence)) {
    throw new ApiError(
      402,
      "Tournament wallet balance is below £2.50. A manager must top up before scoring.",
      "INSUFFICIENT_WALLET_BALANCE",
    );
  }
}

export async function countMatchSquadPlayers(matchId: string): Promise<number> {
  return prisma.matchSquadPlayer.count({ where: { matchId } });
}

/** Charge tournament wallet when a match is finalized (all squad players, both teams). */
export async function chargeMatchAtFinalize(matchId: string): Promise<void> {
  const match = await getMatch(matchId);
  const tournament = await getTournament(match.tournamentId);

  const existing = await prisma.usageLedger.findUnique({
    where: { matchId },
  });
  if (existing) return;

  const playerCount = await countMatchSquadPlayers(matchId);
  const ratePence = resolveFeePerPlayerPence(tournament);
  const amountPence = matchChargePence(playerCount, ratePence);
  const waived = isTournamentBillingWaived(tournament);

  await prisma.$transaction([
    prisma.usageLedger.create({
      data: {
        tournamentId: tournament.id,
        matchId,
        playerCount,
        ratePence,
        amountPence,
        waived,
      },
    }),
    ...(waived || amountPence === 0
      ? []
      : [
          prisma.tournament.update({
            where: { id: tournament.id },
            data: { balancePence: { decrement: amountPence } },
          }),
        ]),
  ]);
}

export async function creditTournamentWallet(
  tournamentId: string,
  amountPence: number,
  topUpId: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.walletTopUp.update({
      where: { id: topUpId },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.tournament.update({
      where: { id: tournamentId },
      data: { balancePence: { increment: amountPence } },
    }),
  ]);
}
