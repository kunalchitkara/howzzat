import {
  DEFAULT_FEE_PER_PLAYER_PENCE,
  matchChargePence,
} from "@howzzat/shared";
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

export async function countMatchSquadPlayers(matchId: string): Promise<number> {
  return prisma.matchSquadPlayer.count({ where: { matchId } });
}

/** Charge tournament wallet when a match is finalized (confirmed lineup, both teams). */
export async function chargeMatchAtFinalize(matchId: string): Promise<void> {
  const match = await getMatch(matchId);
  const tournament = await getTournament(match.tournamentId);

  const existing = await prisma.usageLedger.findUnique({
    where: { matchId },
  });
  if (existing) return;

  // Squad and overs are finalized at toss / lineup confirm — charge uses that lineup.
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
