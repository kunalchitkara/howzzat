import { z } from "zod";

export const orgRoleSchema = z.enum([
  "OWNER",
  "MANAGER",
  "SCORER",
  "VIEWER",
]);

export const matchStatusSchema = z.enum([
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "ABANDONED",
  "WALKOVER",
]);

export const ruleChangeModeSchema = z.enum(["FUTURE_ONLY", "BACKFILL"]);

export const extrasTypeSchema = z.enum([
  "wide",
  "no_ball",
  "bye",
  "leg_bye",
  "wide_runs",
  "no_ball_runs",
]);

export const wicketTypeSchema = z.enum([
  "bowled",
  "caught",
  "stumped",
  "lbw",
  "hit_wicket",
  "run_out",
]);

export const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
  description: z.string().max(500).optional(),
  homeGround: z.string().max(200).optional(),
});

export const createTournamentSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
  ageGroup: z.string().max(20).optional(),
  seasonLabel: z.string().max(50).optional(),
  rulesProfileVersionId: z.string().cuid().optional(),
  rulesTemplateBuiltinId: z.string().optional(),
  rulesOverrides: z.record(z.unknown()).optional(),
  startsOn: z.string().datetime().optional(),
  endsOn: z.string().datetime().optional(),
  isPublic: z.boolean().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
  homeGround: z.string().max(200).optional(),
  ageGroup: z.string().max(20).optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  ageGroup: z.string().max(20).nullable().optional(),
  homeGround: z.string().max(200).nullable().optional(),
});

export const createPlayerSchema = z.object({
  legalName: z.string().min(1).max(120),
  displayName: z.string().max(120).optional(),
  dateOfBirth: z.string().datetime().optional(),
  shirtNumber: z.number().int().min(0).max(99).optional(),
  seasonLabel: z.string().max(50).optional(),
});

export const updatePlayerSchema = z.object({
  legalName: z.string().min(1).max(120).optional(),
  displayName: z.string().max(120).nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  shirtNumber: z.number().int().min(0).max(99).nullable().optional(),
});

export const addTournamentTeamSchema = z.object({
  teamId: z.string().cuid(),
  publicSlug: z.string().min(2).max(64).optional(),
});

export const createMatchSchema = z.object({
  homeTeamId: z.string().cuid(),
  awayTeamId: z.string().cuid(),
  matchNumber: z.number().int().positive().optional(),
  scheduledAt: z.string().datetime().optional(),
  venue: z.string().max(200).optional(),
  playersPerSide: z.number().int().min(6).max(12).optional(),
  isOfficial: z.boolean().optional(),
  publicSlug: z.string().min(2).max(64).optional(),
});

export const electedToSchema = z.enum(["bat", "bowl"]);

export const updateMatchSchema = z.object({
  status: matchStatusSchema.optional(),
  scheduledAt: z.string().datetime().optional(),
  venue: z.string().max(200).optional(),
  resultSummary: z.string().max(500).optional(),
  homeScore: z.number().int().optional(),
  awayScore: z.number().int().optional(),
  marginText: z.string().max(120).optional(),
  winningTeamId: z.string().cuid().optional(),
  tossWinnerId: z.string().cuid().optional(),
  electedTo: electedToSchema.optional(),
  tossCallerPlayerId: z.string().cuid().optional(),
});

export const recordTossSchema = z.object({
  tossWinnerTeamId: z.string().cuid(),
  tossCallerPlayerId: z.string().cuid().optional(),
  electedTo: electedToSchema,
});

export const createInningsSchema = z.object({
  battingTeamId: z.string().cuid(),
  inningsNumber: z.number().int().min(1).max(2),
});

export const updateDeliverySchema = z.object({
  runsOffBat: z.number().int().min(0).max(6).optional(),
  isLegalBall: z.boolean().optional(),
  extrasType: extrasTypeSchema.nullable().optional(),
  extrasRuns: z.number().int().min(0).optional(),
  extrasRunsType: z.enum(["bye", "leg_bye"]).nullable().optional(),
  wicketType: wicketTypeSchema.nullable().optional(),
  strikerId: z.string().cuid().optional(),
  nonStrikerId: z.string().cuid().optional(),
  bowlerId: z.string().cuid().optional(),
  fielderId: z.string().cuid().nullable().optional(),
  dismissedBatsmanId: z.string().cuid().nullable().optional(),
});

export const createDeliverySchema = z.object({
  inningsId: z.string().cuid(),
  overNumber: z.number().int().min(1),
  ballInOver: z.number().int().min(1).max(9),
  isLegalBall: z.boolean().optional(),
  runsOffBat: z.number().int().min(0).max(6).default(0),
  extrasType: extrasTypeSchema.optional(),
  extrasRuns: z.number().int().min(0).default(0),
  extrasRunsType: z.enum(["bye", "leg_bye"]).optional(),
  wicketType: wicketTypeSchema.optional(),
  strikerId: z.string().cuid(),
  nonStrikerId: z.string().cuid(),
  bowlerId: z.string().cuid(),
  fielderId: z.string().cuid().optional(),
  dismissedBatsmanId: z.string().cuid().optional(),
});

export const cloneRulesProfileSchema = z.object({
  templateId: z.string().cuid().optional(),
  builtinId: z.string().optional(),
  name: z.string().min(2).max(120).optional(),
  overrides: z.record(z.unknown()).optional(),
  label: z.string().max(120).optional(),
});

export const ruleChangeSchema = z.object({
  toVersionId: z.string().cuid().optional(),
  overrides: z.record(z.unknown()).optional(),
  mode: ruleChangeModeSchema,
  effectiveFromMatchId: z.string().cuid().optional(),
});

export const createInviteSchema = z.object({
  email: z.string().email(),
  kind: z
    .enum(["MANAGER", "ORG_MANAGER", "ORG_COACH"])
    .optional()
    .transform((k) => (k === "ORG_COACH" ? "ORG_MANAGER" : k)),
  role: orgRoleSchema.optional(),
  teamId: z.string().cuid().optional(),
});

export const confirmSquadsSchema = z.object({
  totalOvers: z.number().int().min(1).max(50).optional(),
});

export const setMatchSquadSchema = z
  .object({
    teamId: z.string().cuid(),
    playerIds: z.array(z.string().cuid()).min(1).max(15),
    captainId: z.string().cuid().optional(),
  })
  .refine(
    (data) => !data.captainId || data.playerIds.includes(data.captainId),
    { message: "Captain must be in the match squad", path: ["captainId"] },
  );
