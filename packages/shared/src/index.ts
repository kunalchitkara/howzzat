export type {
  DeliveryEvent,
  InningsConfig,
  InningsState,
  InningsTotals,
  RuleChangeMode,
  RulesProfile,
} from "@howzzat/rules-engine";

export const HOWZZAT_API_VERSION = "0.0.1";

export {
  MJCA_BUILTIN_PROFILE_IDS,
  listBuiltinProfiles,
  listMjcaProfiles,
} from "@howzzat/rules-engine";

export const BUILTIN_RULE_PROFILE_IDS = [
  "u9-softball-london-v1",
  "demo-2-over-pairs-v1",
  "mjca-u9-outdoor-v1",
  "mjca-u10-boys-pairs-v1",
  "mjca-girls-u10-softball-pairs-v1",
  "mjca-girls-u11-hardball-pairs-v1",
  "mjca-girls-u12-hardball-pairs-v1",
  "mjca-girls-u13-hardball-v1",
  "mjca-girls-u14-hardball-v1",
  "mjca-girls-u15-hardball-v1",
  "mjca-girls-u17-hardball-v1",
  "mjca-u17-premier-v1",
  "mjca-outdoor-standard-20-v1",
] as const;

export type BuiltinRuleProfileId = (typeof BUILTIN_RULE_PROFILE_IDS)[number];
