import {
  getBuiltinProfile,
  mergeProfile,
  type RulesProfile,
} from "@howzzat/rules-engine";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import { parseRulesConfig } from "./rules-helpers";
import {
  RULES_TEMPLATE_SELECT,
  isRulesTemplateSuggested,
  rulesProfileVersionWithTemplate,
} from "./rules-template-select";
import type { cloneRulesProfileSchema } from "../validations";
import type { z } from "zod";

type CloneInput = z.infer<typeof cloneRulesProfileSchema>;

export async function listRulesTemplates(includeConfig = false) {
  const templates = await prisma.rulesProfileTemplate.findMany({
    where: { isPublic: true },
    orderBy: { name: "asc" },
    select: {
      ...RULES_TEMPLATE_SELECT,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          label: true,
          configJson: true,
        },
      },
    },
  });

  return templates.map((t) => ({
    id: t.id,
    builtinId: t.builtinId,
    name: t.name,
    description: t.description,
    isSuggested: isRulesTemplateSuggested(t),
    latestVersion: t.versions[0]
      ? {
          id: t.versions[0].id,
          version: t.versions[0].version,
          label: t.versions[0].label,
          config: includeConfig
            ? parseRulesConfig(t.versions[0].configJson)
            : undefined,
        }
      : null,
  }));
}

export async function getRulesVersion(versionId: string) {
  const version = await prisma.rulesProfileVersion.findUnique({
    where: { id: versionId },
    ...rulesProfileVersionWithTemplate,
  });
  if (!version) {
    throw new ApiError(404, "Rules version not found", "RULES_NOT_FOUND");
  }
  return {
    ...version,
    config: parseRulesConfig(version.configJson),
  };
}

async function resolveBaseProfile(input: CloneInput): Promise<RulesProfile> {
  if (input.baseVersionId) {
    const version = await prisma.rulesProfileVersion.findUnique({
      where: { id: input.baseVersionId },
    });
    if (!version) {
      throw new ApiError(404, "Rules version not found", "RULES_NOT_FOUND");
    }
    return parseRulesConfig(version.configJson);
  }

  if (input.builtinId) {
    const builtin = getBuiltinProfile(input.builtinId);
    if (!builtin) {
      throw new ApiError(404, "Builtin profile not found", "BUILTIN_NOT_FOUND");
    }
    return builtin;
  }

  if (input.templateId) {
    const template = await prisma.rulesProfileTemplate.findUnique({
      where: { id: input.templateId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!template?.versions[0]) {
      throw new ApiError(404, "Template not found", "TEMPLATE_NOT_FOUND");
    }
    return parseRulesConfig(template.versions[0].configJson);
  }

  throw new ApiError(
    400,
    "Provide templateId or builtinId",
    "MISSING_TEMPLATE",
  );
}

export async function cloneRulesProfile(input: CloneInput) {
  const base = await resolveBaseProfile(input);
  const merged = input.overrides
    ? mergeProfile(base, input.overrides as Partial<RulesProfile>)
    : base;

  let templateId = input.templateId;

  if (!templateId) {
    const template = await prisma.rulesProfileTemplate.create({
      data: {
        name: input.name ?? `${base.name} (custom)`,
        description: `Cloned from ${base.id}`,
        isPublic: false,
      },
    });
    templateId = template.id;
  }

  const latest = await prisma.rulesProfileVersion.findFirst({
    where: { templateId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const version = await prisma.rulesProfileVersion.create({
    data: {
      templateId,
      version: nextVersion,
      label: input.label ?? `v${nextVersion}`,
      configJson: JSON.stringify({ ...merged, version: nextVersion }),
    },
    ...rulesProfileVersionWithTemplate,
  });

  return {
    ...version,
    config: parseRulesConfig(version.configJson),
  };
}

export async function resolveRulesVersionForTournament(input: {
  rulesProfileVersionId?: string;
  rulesTemplateBuiltinId?: string;
}) {
  if (input.rulesProfileVersionId) {
    return getRulesVersion(input.rulesProfileVersionId);
  }

  if (input.rulesTemplateBuiltinId) {
    const template = await prisma.rulesProfileTemplate.findUnique({
      where: { builtinId: input.rulesTemplateBuiltinId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!template?.versions[0]) {
      throw new ApiError(
        404,
        "Builtin template not seeded",
        "TEMPLATE_NOT_FOUND",
      );
    }
    return getRulesVersion(template.versions[0].id);
  }

  const defaultTemplate = await prisma.rulesProfileTemplate.findUnique({
    where: { builtinId: "mjca-u9-outdoor-v1" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!defaultTemplate?.versions[0]) {
    throw new ApiError(
      500,
      "Default U9 profile not seeded — run prisma db seed",
      "SEED_REQUIRED",
    );
  }
  return getRulesVersion(defaultTemplate.versions[0].id);
}
