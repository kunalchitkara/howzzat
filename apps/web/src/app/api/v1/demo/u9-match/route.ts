import { getBuiltinProfile } from "@howzzat/rules-engine";
import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { buildMatchSquadRows, seedTeamRoster } from "@/lib/demo/seed-roster";
import { prisma } from "@/lib/db";
import { resolveRulesVersionForTournament } from "@/lib/services/rules";

export const runtime = "nodejs";

const PROFILE_ID = "demo-u9-4-over-v1";
const TOTAL_OVERS = 4;
const PLAYERS_PER_SIDE = 4;
const ROSTER_SIZE = 10;

const BLUES_ROSTER = [
  "Gurfateh",
  "Arjun",
  "Sahib",
  "Ekamvir",
  "Rudransh",
  "Veer",
  "Avyaan",
  "Qaim",
  "Kiran",
  "Dev",
];

const GOLDS_ROSTER = [
  "Noah",
  "Leo",
  "Kaiyan",
  "Elijah",
  "Taran",
  "Aanya",
  "Harshan",
  "Sehaj",
  "Maya",
  "Rohan",
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

/** Create or reset a U9-style 4-over demo (4 players per side, 10 in roster, 200 start, −5 per wicket). */
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
    where: { organizationId_slug: { organizationId: org.id, slug: "u9-blues" } },
    create: {
      organizationId: org.id,
      name: "U9 Blues",
      slug: "u9-blues",
      ageGroup: "U9",
    },
    update: {},
  });
  const teamB = await prisma.team.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "u9-golds" } },
    create: {
      organizationId: org.id,
      name: "U9 Golds",
      slug: "u9-golds",
      ageGroup: "U9",
    },
    update: {},
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
    create: { tournamentId: tournament.id, teamId: teamA.id, publicSlug: "blues" },
    update: {},
  });
  const ttB = await prisma.tournamentTeam.upsert({
    where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: teamB.id } },
    create: { tournamentId: tournament.id, teamId: teamB.id, publicSlug: "golds" },
    update: {},
  });

  const bluesIds = await seedTeamRoster(prisma, teamA.id, BLUES_ROSTER, "u9-demo");
  const goldsIds = await seedTeamRoster(prisma, teamB.id, GOLDS_ROSTER, "u9-demo");

  const squadRows = [
    ...buildMatchSquadRows(teamA.id, bluesIds, PLAYERS_PER_SIDE),
    ...buildMatchSquadRows(teamB.id, goldsIds, PLAYERS_PER_SIDE),
  ];

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
        totalOvers: TOTAL_OVERS,
        startingScore: 200,
        wicketPenalty: 5,
        playersPerSide: PLAYERS_PER_SIDE,
        rosterSize: ROSTER_SIZE,
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
      venue: "Canons High School (U9 demo)",
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

  return json(
    {
      data: {
        matchId: match.id,
        homeTeam: teamA.name,
        awayTeam: teamB.name,
        totalOvers: TOTAL_OVERS,
        startingScore: 200,
        wicketPenalty: 5,
        playersPerSide: PLAYERS_PER_SIDE,
        rosterSize: ROSTER_SIZE,
        reset: false,
      },
    },
    201,
  );
});
