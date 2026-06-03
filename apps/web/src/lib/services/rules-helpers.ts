import type { RulesProfile } from "@howzzat/rules-engine";
import { prisma } from "../db";
import { ApiError } from "../api/http";

export async function getRulesProfileFromVersion(
  versionId: string,
): Promise<RulesProfile> {
  const version = await prisma.rulesProfileVersion.findUnique({
    where: { id: versionId },
  });
  if (!version) {
    throw new ApiError(404, "Rules profile version not found", "RULES_NOT_FOUND");
  }
  return JSON.parse(version.configJson) as RulesProfile;
}

export function parseRulesConfig(configJson: string): RulesProfile {
  return JSON.parse(configJson) as RulesProfile;
}
