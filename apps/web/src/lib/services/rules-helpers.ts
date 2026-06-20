import type { RulesProfile } from "@howzzat/rules-engine";
import { getBuiltinProfile, mergeProfile } from "@howzzat/rules-engine";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import { rulesProfileVersionWithTemplate } from "./rules-template-select";

const DEMO_TOURNAMENT_SLUGS = new Set(["ios-demo", "u9-demo"]);

/** Coach tournament still resolving to a demo-sized squad cap (e.g. max 2). */
export function coachTournamentStuckOnDemoCap(
  tournamentSlug: string,
  squadMax: number,
): boolean {
  return squadMax <= 2 && !DEMO_TOURNAMENT_SLUGS.has(tournamentSlug);
}

export async function getRulesProfileFromVersion(
  versionId: string,
): Promise<RulesProfile> {
  const version = await prisma.rulesProfileVersion.findUnique({
    where: { id: versionId },
    ...rulesProfileVersionWithTemplate,
  });
  if (!version) {
    throw new ApiError(404, "Rules profile version not found", "RULES_NOT_FOUND");
  }
  const stored = JSON.parse(version.configJson) as RulesProfile;
  const builtinId = version.template.builtinId;
  if (builtinId) {
    const builtin = getBuiltinProfile(builtinId);
    if (builtin) {
      return mergeProfile(builtin, stored);
    }
  }
  return stored;
}

/** Ensure MJCA U9 rules version exists (e.g. prod DB missing seed). */
async function ensureMjcaU9RulesVersionId(): Promise<string | null> {
  const existing = await prisma.rulesProfileVersion.findFirst({
    where: { template: { builtinId: "mjca-u9-outdoor-v1" }, version: 1 },
    select: { id: true },
  });
  if (existing) return existing.id;

  const profile = getBuiltinProfile("mjca-u9-outdoor-v1");
  if (!profile) return null;

  const template = await prisma.rulesProfileTemplate.upsert({
    where: { builtinId: "mjca-u9-outdoor-v1" },
    create: {
      builtinId: "mjca-u9-outdoor-v1",
      name: profile.name,
      description: profile.description,
      isPublic: true,
      isSuggested: true,
    },
    update: {
      name: profile.name,
      description: profile.description,
      isPublic: true,
      isSuggested: true,
    },
  });
  const version = await prisma.rulesProfileVersion.upsert({
    where: {
      templateId_version: { templateId: template.id, version: 1 },
    },
    create: {
      templateId: template.id,
      version: 1,
      configJson: JSON.stringify(profile),
    },
    update: { configJson: JSON.stringify(profile) },
  });
  return version.id;
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
    ...rulesProfileVersionWithTemplate,
  });
  const builtinId = version?.template.builtinId;
  const currentProfile = await getRulesProfileFromVersion(input.rulesVersionId);
  const stuckOnDemoCap = currentProfile.playersPerSide.max <= 2;
  const usesDemoTemplate = Boolean(builtinId?.startsWith("demo-"));

  if (!usesDemoTemplate && !stuckOnDemoCap) {
    return input.rulesVersionId;
  }

  const mjcaVersionId = await ensureMjcaU9RulesVersionId();
  if (!mjcaVersionId) {
    return input.rulesVersionId;
  }

  await prisma.tournament.update({
    where: { id: input.tournamentId },
    data: { rulesProfileVersionId: mjcaVersionId },
  });
  await prisma.match.updateMany({
    where: {
      tournamentId: input.tournamentId,
      squadsConfirmedAt: null,
      innings: { none: {} },
    },
    data: { rulesVersionId: mjcaVersionId },
  });

  return mjcaVersionId;
}

export function parseRulesConfig(configJson: string): RulesProfile {
  return JSON.parse(configJson) as RulesProfile;
}
