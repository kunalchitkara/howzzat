/** Prisma select for RulesProfileTemplate — omits isSuggested for Turso DBs missing the column. */
export const RULES_TEMPLATE_SELECT = {
  id: true,
  builtinId: true,
  name: true,
  description: true,
  isPublic: true,
} as const;

export type RulesTemplateSummary = {
  id: string;
  builtinId: string | null;
  name: string;
  description: string | null;
  isPublic: boolean;
  isSuggested?: boolean;
};

/** Suggested badge when isSuggested column is absent or unset on legacy Turso rows. */
export function isRulesTemplateSuggested(template: {
  builtinId: string | null;
  isSuggested?: boolean;
}): boolean {
  if (typeof template.isSuggested === "boolean") return template.isSuggested;
  return template.builtinId === "mjca-u9-outdoor-v1";
}

export const rulesProfileVersionWithTemplate = {
  include: { template: { select: RULES_TEMPLATE_SELECT } },
} as const;
