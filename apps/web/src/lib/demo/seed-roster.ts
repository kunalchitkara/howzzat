import type { PrismaClient } from "@howzzat/db";

/** Register full club roster on a team; returns player ids in name order. */
export async function seedTeamRoster(
  prisma: PrismaClient,
  teamId: string,
  names: string[],
  seasonLabel: string,
): Promise<string[]> {
  const playerIds: string[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    let player = await prisma.player.findFirst({
      where: {
        OR: [{ legalName: name }, { legalName: `${name} (C)` }],
      },
    });
    if (player && player.legalName !== name) {
      player = await prisma.player.update({
        where: { id: player.id },
        data: { legalName: name, displayName: name },
      });
    }
    if (!player) {
      player = await prisma.player.create({
        data: { legalName: name, displayName: name },
      });
    }

    await prisma.teamMembership.upsert({
      where: {
        teamId_playerId_seasonLabel: {
          teamId,
          playerId: player.id,
          seasonLabel,
        },
      },
      create: {
        teamId,
        playerId: player.id,
        shirtNumber: i + 1,
        seasonLabel,
      },
      update: { shirtNumber: i + 1 },
    });

    playerIds.push(player.id);
  }

  return playerIds;
}

/** Pick the first N roster players for the match squad; first is captain. */
export function buildMatchSquadRows(
  teamId: string,
  rosterPlayerIds: string[],
  playersPerSide: number,
): { playerId: string; teamId: string; role: string }[] {
  return rosterPlayerIds.slice(0, playersPerSide).map((playerId, index) => ({
    playerId,
    teamId,
    role: index === 0 ? "captain" : "player",
  }));
}
