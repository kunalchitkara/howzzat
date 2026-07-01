import type { MatchStatus, PrismaClient } from "@prisma/client";
import { seedRulesProfileTemplates } from "@howzzat/db/seed-rules";

export const EDGWARE_CC_ORG_SLUG = "edgware-cc";
export const EDGWARE_U9_2026_SLUG = "u9-2026";

const FIXTURE_SLUGS = [
  "u9-edgware-pinner-20260426",
  "u9-h-manor-edgware-20260510",
  "u9-edgware-harefield-20260524",
  "u9-hayes-edgware-20260531",
  "u9-edgware-harefield-20260607",
  "u9-pinner-edgware-20260614",
  "u9-edgware-h-manor-20260621",
] as const;

type FixtureSeed = {
  matchNumber: number;
  slug: (typeof FIXTURE_SLUGS)[number];
  scheduledAt: Date;
  homePublicSlug: string;
  awayPublicSlug: string;
  venue: string;
  status: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  marginText?: string | null;
  winnerPublicSlug?: string | null;
};

const FIXTURES: FixtureSeed[] = [
  {
    matchNumber: 1,
    slug: "u9-edgware-pinner-20260426",
    scheduledAt: new Date("2026-04-26T09:00:00.000Z"),
    homePublicSlug: "edgware",
    awayPublicSlug: "pinner",
    venue: "Canons High School",
    status: "WALKOVER",
    marginText: "Edgware won (walkover — Pinner forfeited)",
    winnerPublicSlug: "edgware",
  },
  {
    matchNumber: 2,
    slug: "u9-h-manor-edgware-20260510",
    scheduledAt: new Date("2026-05-10T09:00:00.000Z"),
    homePublicSlug: "h-manor",
    awayPublicSlug: "edgware",
    venue: "Headstone Manor",
    status: "COMPLETED",
    homeScore: 265,
    awayScore: 297,
    marginText: "Edgware won by 32 runs",
    winnerPublicSlug: "edgware",
  },
  {
    matchNumber: 3,
    slug: "u9-edgware-harefield-20260524",
    scheduledAt: new Date("2026-05-24T09:00:00.000Z"),
    homePublicSlug: "edgware",
    awayPublicSlug: "harefield",
    venue: "Canons High School",
    status: "WALKOVER",
    marginText: "Edgware won (walkover — Harefield conceded)",
    winnerPublicSlug: "edgware",
  },
  {
    matchNumber: 4,
    slug: "u9-hayes-edgware-20260531",
    scheduledAt: new Date("2026-05-31T09:00:00.000Z"),
    homePublicSlug: "hayes",
    awayPublicSlug: "edgware",
    venue: "The Pavilion, Hayes",
    status: "COMPLETED",
    homeScore: 281,
    awayScore: 230,
    marginText: "Hayes won by 51 runs",
    winnerPublicSlug: "hayes",
  },
  {
    matchNumber: 5,
    slug: "u9-edgware-harefield-20260607",
    scheduledAt: new Date("2026-06-07T09:00:00.000Z"),
    homePublicSlug: "edgware",
    awayPublicSlug: "harefield",
    venue: "Canons High School",
    status: "COMPLETED",
    homeScore: 315,
    awayScore: 307,
    marginText: "Edgware won by 8 runs",
    winnerPublicSlug: "edgware",
  },
  {
    matchNumber: 6,
    slug: "u9-pinner-edgware-20260614",
    scheduledAt: new Date("2026-06-14T09:00:00.000Z"),
    homePublicSlug: "pinner",
    awayPublicSlug: "edgware",
    venue: "Pinner",
    status: "COMPLETED",
    homeScore: 263,
    awayScore: 308,
    marginText: "Edgware won by 45 runs",
    winnerPublicSlug: "edgware",
  },
  {
    matchNumber: 7,
    slug: "u9-edgware-h-manor-20260621",
    scheduledAt: new Date("2026-06-21T09:00:00.000Z"),
    homePublicSlug: "edgware",
    awayPublicSlug: "h-manor",
    venue: "Canons High School",
    status: "COMPLETED",
    homeScore: 253,
    awayScore: 192,
    marginText: "Edgware won by 61 runs",
    winnerPublicSlug: "edgware",
  },
];

const CLUB_TEAM = {
  name: "Edgware U9 Softball",
  slug: "u9-softball",
  publicSlug: "edgware",
  ageGroup: "U9",
  homeGround: "Canons High School",
} as const;

const OPPONENT_TEAMS = [
  { name: "Pinner U9", slug: "pinner-u9", publicSlug: "pinner" },
  { name: "Headstone Manor U9", slug: "h-manor-u9", publicSlug: "h-manor" },
  { name: "Harefield U9", slug: "harefield-u9", publicSlug: "harefield" },
  { name: "Hayes U9", slug: "hayes-u9", publicSlug: "hayes" },
] as const;

const EDGWARE_PLAYER_NAMES = [
  "Ariyan",
  "Krish",
  "Veer",
  "Avyaan",
  "Qaim",
  "Kaiyan",
  "Aanya",
  "Taran",
] as const;

export function isEdgwarePublicU92026(orgSlug: string, tournamentSlug: string): boolean {
  return orgSlug === EDGWARE_CC_ORG_SLUG && tournamentSlug === EDGWARE_U9_2026_SLUG;
}

async function seedEdgwareRoster(
  prisma: PrismaClient,
  teamId: string,
): Promise<void> {
  for (let i = 0; i < EDGWARE_PLAYER_NAMES.length; i++) {
    const name = EDGWARE_PLAYER_NAMES[i]!;
    const existing = await prisma.player.findFirst({
      where: { legalName: name },
    });
    const player =
      existing ??
      (await prisma.player.create({
        data: { legalName: name, displayName: name },
      }));

    await prisma.teamMembership.upsert({
      where: {
        teamId_playerId_seasonLabel: {
          teamId,
          playerId: player.id,
          seasonLabel: "2026",
        },
      },
      create: {
        teamId,
        playerId: player.id,
        shirtNumber: i + 1,
        seasonLabel: "2026",
      },
      update: {},
    });
  }
}

/** Idempotently ensure the public Edgware U9 Summer 2026 hub exists with season fixtures. */
export async function ensurePublicEdgwareU92026(prisma: PrismaClient): Promise<void> {
  await seedRulesProfileTemplates(prisma);

  const template = await prisma.rulesProfileTemplate.findUnique({
    where: { builtinId: "u9-softball-london-v1" },
    include: { versions: { where: { version: 1 } } },
  });
  const rulesVersion = template?.versions[0];
  if (!rulesVersion) {
    throw new Error("u9-softball-london-v1 rules profile not seeded");
  }

  const existingTournament = await prisma.tournament.findFirst({
    where: {
      slug: EDGWARE_U9_2026_SLUG,
      organization: { slug: EDGWARE_CC_ORG_SLUG },
      isPublic: true,
    },
    select: { id: true },
  });
  if (existingTournament) {
    const fixtureCount = await prisma.match.count({
      where: {
        tournamentId: existingTournament.id,
        slug: { in: [...FIXTURE_SLUGS] },
      },
    });
    if (fixtureCount >= FIXTURES.length) return;
  }

  const org = await prisma.organization.upsert({
    where: { slug: EDGWARE_CC_ORG_SLUG },
    create: {
      name: "Edgware Cricket Club",
      slug: EDGWARE_CC_ORG_SLUG,
      description: "Edgware Cricket Club — U9 Softball",
      homeGround: "Canons High School (HA8 6AN)",
    },
    update: {
      name: "Edgware Cricket Club",
      homeGround: "Canons High School (HA8 6AN)",
    },
  });

  const clubTeam = await prisma.team.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: CLUB_TEAM.slug },
    },
    create: {
      organizationId: org.id,
      name: CLUB_TEAM.name,
      slug: CLUB_TEAM.slug,
      ageGroup: CLUB_TEAM.ageGroup,
      homeGround: CLUB_TEAM.homeGround,
    },
    update: {
      name: CLUB_TEAM.name,
      ageGroup: CLUB_TEAM.ageGroup,
      homeGround: CLUB_TEAM.homeGround,
    },
  });

  const tournament = await prisma.tournament.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: EDGWARE_U9_2026_SLUG },
    },
    create: {
      organizationId: org.id,
      name: "U9 Softball Summer 2026",
      slug: EDGWARE_U9_2026_SLUG,
      ageGroup: "U9",
      seasonLabel: "Summer 2026",
      rulesProfileVersionId: rulesVersion.id,
      isPublic: true,
      rulesBindings: {
        create: {
          rulesProfileVersionId: rulesVersion.id,
          notes: "Public hub binding",
        },
      },
    },
    update: {
      name: "U9 Softball Summer 2026",
      ageGroup: "U9",
      seasonLabel: "Summer 2026",
      rulesProfileVersionId: rulesVersion.id,
      isPublic: true,
    },
  });

  const tournamentTeamIds = new Map<string, string>();

  const clubTt = await prisma.tournamentTeam.upsert({
    where: {
      tournamentId_teamId: { tournamentId: tournament.id, teamId: clubTeam.id },
    },
    create: {
      tournamentId: tournament.id,
      teamId: clubTeam.id,
      publicSlug: CLUB_TEAM.publicSlug,
    },
    update: { publicSlug: CLUB_TEAM.publicSlug },
  });
  tournamentTeamIds.set(CLUB_TEAM.publicSlug, clubTt.id);

  for (const opponent of OPPONENT_TEAMS) {
    const team = await prisma.team.upsert({
      where: {
        organizationId_slug: { organizationId: org.id, slug: opponent.slug },
      },
      create: {
        organizationId: org.id,
        name: opponent.name,
        slug: opponent.slug,
        ageGroup: "U9",
      },
      update: { name: opponent.name, ageGroup: "U9" },
    });

    const tt = await prisma.tournamentTeam.upsert({
      where: {
        tournamentId_teamId: { tournamentId: tournament.id, teamId: team.id },
      },
      create: {
        tournamentId: tournament.id,
        teamId: team.id,
        publicSlug: opponent.publicSlug,
      },
      update: { publicSlug: opponent.publicSlug },
    });
    tournamentTeamIds.set(opponent.publicSlug, tt.id);
  }

  await seedEdgwareRoster(prisma, clubTeam.id);

  for (const fixture of FIXTURES) {
    const homeTeamId = tournamentTeamIds.get(fixture.homePublicSlug);
    const awayTeamId = tournamentTeamIds.get(fixture.awayPublicSlug);
    if (!homeTeamId || !awayTeamId) continue;

    const winningTeamId = fixture.winnerPublicSlug
      ? (tournamentTeamIds.get(fixture.winnerPublicSlug) ?? null)
      : null;

    const existing = await prisma.match.findFirst({
      where: { slug: fixture.slug },
    });

    const matchData = {
      tournamentId: tournament.id,
      homeTeamId,
      awayTeamId,
      matchNumber: fixture.matchNumber,
      scheduledAt: fixture.scheduledAt,
      venue: fixture.venue,
      status: fixture.status,
      homeScore: fixture.homeScore ?? null,
      awayScore: fixture.awayScore ?? null,
      marginText: fixture.marginText ?? null,
      winningTeamId,
      rulesVersionId: rulesVersion.id,
      slug: fixture.slug,
      isOfficial: true,
    };

    if (existing) {
      await prisma.match.update({
        where: { id: existing.id },
        data: matchData,
      });
    } else {
      await prisma.match.create({ data: matchData });
    }
  }
}
