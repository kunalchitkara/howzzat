import type { RulesProfile } from "@howzzat/rules-engine";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { prisma } from "../db";
import { ApiError } from "../api/http";

const DEMO_TOURNAMENT_SLUGS = new Set(["ios-demo", "u9-demo"]);

export async function getRulesProfileFromVersion(
  versionId: string,
): Promise<RulesProfile> {
  const version = await prisma.rulesProfileVersion.findUnique({
    where: { id: versionId },
    include: { template: true },
  });
  if (!version) {
    throw new ApiError(404, "Rules profile version not found", "RULES_NOT_FOUND");
  }
  const stored = JSON.parse(version.configJson) as RulesProfile;
  const builtinId = version.template.builtinId;
  if (builtinId) {
    const builtin = getBuiltinProfile(builtinId);
    if (builtin) {
      return { ...builtin, version: stored.version ?? builtin.version };
    }
  }
  return stored;
}

/**
 * Coach tournaments must not use demo-only rules. Rebinds misassigned tournaments
 * to MJCA U9 on access (also handled by seed-rules migration).
 */
export async function resolveRulesVersionIdForCoachTournament(input: {
  tournamentId: string;
  tournamentSlug: string;
  rulesVersionId: string;
}): Promise<string> {
  if (DEMO_TOURNAMENT_SLUGS.has(input.tournamentSlug)) {
    return input.rulesVersionId;
  }

  const version = await prisma.rulesProfileVersion.findUnique({
    where: { id: input.rulesVersionId },
    include: { template: true },
  });
  const builtinId = version?.template.builtinId;
  if (!builtinId?.startsWith("demo-")) {
    return input.rulesVersionId;
  }

  const mjcaVersion = await prisma.rulesProfileVersion.findFirst({
    where: { template: { builtinId: "mjca-u9-outdoor-v1" }, version: 1 },
  });
  if (!mjcaVersion) {
    return input.rulesVersionId;
  }

  await prisma.tournament.update({
    where: { id: input.tournamentId },
    data: { rulesProfileVersionId: mjcaVersion.id },
  });
  await prisma.match.updateMany({
    where: {
      tournamentId: input.tournamentId,
      squadsConfirmedAt: null,
      innings: { none: {} },
    },
    data: { rulesVersionId: mjcaVersion.id },
  });

  return mjcaVersion.id;
}

export function parseRulesConfig(configJson: string): RulesProfile {
  return JSON.parse(configJson) as RulesProfile;
}
