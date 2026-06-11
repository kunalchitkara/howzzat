import { getBuiltinProfile } from "@howzzat/rules-engine";
import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { buildMatchSquadRows, seedTeamRoster } from "@/lib/demo/seed-roster";
import { prisma } from "@/lib/db";
import { resolveRulesVersionForTournament } from "@/lib/services/rules";

export const runtime = "nodejs";

const PROFILE_ID = "demo-2-over-pairs-v1";
const PLAYERS_PER_SIDE = 2;

const BLUES_ROSTER = [
  "Alex",
  "Sam",
  "Charlie",
  "Morgan",
  "Jamie",
  "Taylor",
  "Riley",
  "Casey",
];

const GOLDS_ROSTER = [
  "Jordan",
  "Logan",
  "Drew",
  "Quinn",
  "Avery",
  "Skyler",
  "Parker",
  "Reese",
];

async function ensureDemoProfile() {
  const profile = getBuiltinProfile(PROFILE_ID);
  if (!profile) throw new Error(`${PROFILE_ID} not in rules-engine`);
  const configJson = JSON.stringify(profile);
  const template = await prisma.rulesProfileTemplate.upsert({
    where: { builtinId: PROFILE_ID },
    create: {
      builtinId: PROFILE_ID,
      name: profile.name,
      description: profile.description,
      isPublic: true,
    },
    update: {},
  });
  await prisma.rulesProfileVersion.upsert({
    where: { templateId_version: { templateId: template.id, version: 1 } },
    create: { templateId: template.id, version: 1, configJson },
    update: { configJson },
  });
}

/** Create or reset a 2-over pairs demo match for the iOS scorer. */
export const POST = withApi(async () => {
  await ensureDemoProfile();
  const rulesVersion = await resolveRulesVersionForTournament({
    rulesTemplateBuiltinId: PROFILE_ID,
  });

  let org = await prisma.organization.findUnique({ where: { slug: "edgware-cc" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Edgware Cricket Club", slug: "edgware-cc" },
    });
  }

  const teamA = await prisma.team.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "ios-blues" } },
    create: {
      organizationId: org.id,
      name: "iOS Blues",
      slug: "ios-blues",
      ageGroup: "Demo",
    },
    update: {},
  });
  const teamB = await prisma.team.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "ios-golds" } },
    create: {
      organizationId: org.id,
      name: "iOS Golds",
      slug: "ios-golds",
      ageGroup: "Demo",
    },
    update: {},
  });

  const tournament = await prisma.tournament.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "ios-demo" } },
    create: {
      organizationId: org.id,
      name: "iOS Demo Cup",
      slug: "ios-demo",
      ageGroup: "Demo",
      rulesProfileVersionId: rulesVersion.id,
      isPublic: true,
      rulesBindings: { create: { rulesProfileVersionId: rulesVersion.id } },
    },
    update: { rulesProfileVersionId: rulesVersion.id },
  });

  const ttA = await prisma.tournamentTeam.upsert({
    where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: teamA.id } },
    create: { tournamentId: tournament.id, teamId: teamA.id, publicSlug: "blues" },
    update: {},
  });
  const ttB = await prisma.tournamentTeam.upsert({
    where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: teamB.id } },
    create: { tournamentId: tournament.id, teamId: teamB.id, publicSlug: "golds" },
    update: {},
  });

  const bluesIds = await seedTeamRoster(prisma, teamA.id, BLUES_ROSTER, "demo");
  const goldsIds = await seedTeamRoster(prisma, teamB.id, GOLDS_ROSTER, "demo");

  const squadRows = [
    ...buildMatchSquadRows(teamA.id, bluesIds, PLAYERS_PER_SIDE),
    ...buildMatchSquadRows(teamB.id, goldsIds, PLAYERS_PER_SIDE),
  ];

  const existing = await prisma.match.findFirst({
    where: { tournamentId: tournament.id, publicSlug: "ios-live" },
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
        status: "SCHEDULED",
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
        totalOvers: 2,
      },
    });
    await prisma.matchSquadPlayer.createMany({
      data: squadRows.map((r) => ({ ...r, matchId: existing.id })),
    });
    return json({
      data: {
        matchId: existing.id,
        homeTeam: teamA.name,
        awayTeam: teamB.name,
        totalOvers: 2,
        reset: true,
      },
    });
  }

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeTeamId: ttA.id,
      awayTeamId: ttB.id,
      matchNumber: 1,
      venue: "iOS Demo Ground",
      playersPerSide: PLAYERS_PER_SIDE,
      totalOvers: 2,
      publicSlug: "ios-live",
      rulesVersionId: rulesVersion.id,
      status: "SCHEDULED",
      squad: {
        create: squadRows,
      },
    },
  });

  return json(
    {
      data: {
        matchId: match.id,
        homeTeam: teamA.name,
        awayTeam: teamB.name,
        totalOvers: 2,
        reset: false,
      },
    },
    201,
  );
});
