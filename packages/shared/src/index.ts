export type {
  DeliveryEvent,
  InningsConfig,
  InningsState,
  InningsTotals,
  RuleChangeMode,
  RulesProfile,
} from "@howzzat/rules-engine";

export const HOWZZAT_API_VERSION = "0.0.1";

export const BUILTIN_RULE_PROFILE_IDS = ["u9-softball-london-v1"] as const;

export type BuiltinRuleProfileId = (typeof BUILTIN_RULE_PROFILE_IDS)[number];
