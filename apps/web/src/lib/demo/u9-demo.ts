import { getBuiltinProfile } from "@howzzat/rules-engine";
import { EDGWARE_U9_ROSTER, HAYES_ROSTER } from "@/lib/demo/demo-rosters";
import { buildMatchSquadRows, seedTeamRoster } from "@/lib/demo/seed-roster";
import { prisma } from "@/lib/db";
import { resolveRulesVersionForTournament } from "@/lib/services/rules";

export const U9_DEMO_PROFILE_ID = "demo-u9-4-over-v1";
export const U9_DEMO_VENUE = "U9 Demo Ground";
const TOTAL_OVERS = 4;
const PLAYERS_PER_SIDE = 4;
const ROSTER_SIZE = 10;

async function ensureDemoProfile() {
  const profile = getBuiltinProfile(U9_DEMO_PROFILE_ID);
  if (!profile) throw new Error(`${U9_DEMO_PROFILE_ID} not in rules-engine`);
  const configJson = JSON.stringify(profile);
  const template = await prisma.rulesProfileTemplate.upsert({
    where: { builtinId: U9_DEMO_PROFILE_ID },
    create: {
      builtinId: U9_DEMO_PROFILE_ID,
      name: profile.name,
      description: profile.description,
      isPublic: true,
    },
    update: {
      name: profile.name,
      description: profile.description,
    },
  });
  await prisma.rulesProfileVersion.upsert({
    where: { templateId_version: { templateId: template.id, version: 1 } },
    create: { templateId: template.id, version: 1, configJson },
    update: { configJson },
  });
}

export type U9DemoMatchResult = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  totalOvers: number;
  startingScore: number;
  wicketPenalty: number;
  playersPerSide: number;
  rosterSize: number;
  reset: boolean;
};

/** Create or fully reset the u9-live demo match (teams, rosters, squads). */
export async function resetOrCreateU9DemoMatch(): Promise<U9DemoMatchResult> {
  await ensureDemoProfile();
  const rulesVersion = await resolveRulesVersionForTournament({
    rulesTemplateBuiltinId: U9_DEMO_PROFILE_ID,
  });

  let org = await prisma.organization.findUnique({ where: { slug: "edgware-cc" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Edgware Cricket Club", slug: "edgware-cc" },
    });
  }

  const teamA = await prisma.team.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "edgware-u9" } },
    create: {
      organizationId: org.id,
      name: "Edgware U9",
      slug: "edgware-u9",
      ageGroup: "U9",
    },
    update: { name: "Edgware U9", ageGroup: "U9" },
  });
  const teamB = await prisma.team.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "hayes" } },
    create: {
      organizationId: org.id,
      name: "Hayes",
      slug: "hayes",
      ageGroup: "U9",
    },
    update: { name: "Hayes", ageGroup: "U9" },
  });

  const tournament = await prisma.tournament.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "u9-demo" } },
    create: {
      organizationId: org.id,
      name: "U9 Demo Cup",
      slug: "u9-demo",
      ageGroup: "U9",
      rulesProfileVersionId: rulesVersion.id,
      isPublic: true,
      rulesBindings: { create: { rulesProfileVersionId: rulesVersion.id } },
    },
    update: { rulesProfileVersionId: rulesVersion.id },
  });

  const ttA = await prisma.tournamentTeam.upsert({
    where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: teamA.id } },
    create: { tournamentId: tournament.id, teamId: teamA.id, publicSlug: "edgware-u9" },
    update: { publicSlug: "edgware-u9" },
  });
  const ttB = await prisma.tournamentTeam.upsert({
    where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: teamB.id } },
    create: { tournamentId: tournament.id, teamId: teamB.id, publicSlug: "hayes" },
    update: { publicSlug: "hayes" },
  });

  const edgwareIds = await seedTeamRoster(
    prisma,
    teamA.id,
    [...EDGWARE_U9_ROSTER],
    "u9-demo",
  );
  const hayesIds = await seedTeamRoster(prisma, teamB.id, [...HAYES_ROSTER], "u9-demo");

  const squadRows = [
    ...buildMatchSquadRows(teamA.id, edgwareIds, PLAYERS_PER_SIDE),
    ...buildMatchSquadRows(teamB.id, hayesIds, PLAYERS_PER_SIDE),
  ];

  const profile = getBuiltinProfile(U9_DEMO_PROFILE_ID)!;
  const existing = await prisma.match.findFirst({
    where: { tournamentId: tournament.id, publicSlug: "u9-live" },
  });

  if (existing) {
    await prisma.delivery.deleteMany({
      where: { innings: { matchId: existing.id } },
    });
    await prisma.innings.deleteMany({ where: { matchId: existing.id } });
    await prisma.matchSquadPlayer.deleteMany({ where: { matchId: existing.id } });
    await prisma.match.update({
      where: { id: existing.id },
      data: {
        homeTeamId: ttA.id,
        awayTeamId: ttB.id,
        venue: U9_DEMO_VENUE,
        status: "SCHEDULED",
        playersPerSide: PLAYERS_PER_SIDE,
        rulesVersionId: rulesVersion.id,
        homeScore: null,
        awayScore: null,
        marginText: null,
        resultSummary: null,
        winningTeamId: null,
        tossWinnerId: null,
        electedTo: null,
        tossCallerPlayerId: null,
        squadsConfirmedAt: null,
        chaseContinuedAfterTarget: false,
        totalOvers: TOTAL_OVERS,
        publicSlug: "u9-live",
        scoringUserId: null,
        scoringClaimedAt: null,
      },
    });
    await prisma.matchSquadPlayer.createMany({
      data: squadRows.map((r) => ({ ...r, matchId: existing.id })),
    });
    return {
      matchId: existing.id,
      homeTeam: teamA.name,
      awayTeam: teamB.name,
      totalOvers: TOTAL_OVERS,
      startingScore: profile.startingScore,
      wicketPenalty: profile.wicketPenalty,
      playersPerSide: PLAYERS_PER_SIDE,
      rosterSize: ROSTER_SIZE,
      reset: true,
    };
  }

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeTeamId: ttA.id,
      awayTeamId: ttB.id,
      matchNumber: 1,
      venue: U9_DEMO_VENUE,
      playersPerSide: PLAYERS_PER_SIDE,
      totalOvers: TOTAL_OVERS,
      publicSlug: "u9-live",
      rulesVersionId: rulesVersion.id,
      status: "SCHEDULED",
      squad: {
        create: squadRows,
      },
    },
  });

  return {
    matchId: match.id,
    homeTeam: teamA.name,
    awayTeam: teamB.name,
    totalOvers: TOTAL_OVERS,
    startingScore: profile.startingScore,
    wicketPenalty: profile.wicketPenalty,
    playersPerSide: PLAYERS_PER_SIDE,
    rosterSize: ROSTER_SIZE,
    reset: false,
  };
}
