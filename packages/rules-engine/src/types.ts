/** Middlesex / London league context — informational + designer overrides. */
export interface LeagueMetadata {
  prefix: string;
  sourceUrl: string;
  ageGroup: string;
  competition: string;
  season?: string;
  ballType?: "softball" | "incrediball" | "hardball";
  pitchYards?: number;
  boundaryYards?: number;
  playersNote?: string;
  /** Profile fields tournament designers can override when cloning. */
  tunable?: (
    | "playersPerSide"
    | "pairOvers"
    | "startingScore"
    | "wicketPenalty"
    | "wide"
    | "noBall"
    | "totalOvers"
  )[];
  /** Documented in template; not yet enforced by the scoring engine. */
  pendingEngine?: string[];
}

/** Immutable rules configuration for a tournament or match. */
export interface RulesProfile {
  id: string;
  name: string;
  description: string;
  version: number;
  format: "pairs_single_innings" | "standard_innings";
  playersPerSide: { min: number; max: number; default: number };
  oversPerInnings: { formula: string };
  pairOvers: number;
  startingScore: number;
  wicketPenalty: number;
  scoring: RulesScoring;
  dismissals: RulesDismissals;
  display: RulesDisplay;
  symbols?: Record<string, string | string[]>;
  league?: LeagueMetadata;
}

export interface RulesScoring {
  runsOffBat: { min: number; max: number };
  wide: ExtraRuleWithLastOver;
  noBall: ExtraRuleWithLastOver;
  bye: { creditToBatsman: boolean; enterTotalRuns: boolean };
  legBye: { creditToBatsman: boolean; enterTotalRuns: boolean };
}

export interface ExtraRuleWithLastOver {
  default: ExtraRule;
  lastOver: ExtraRule & { maxExtraBalls?: number };
}

export interface ExtraRule {
  runs: number;
  rebowl: boolean;
  creditToBatsman?: boolean;
  maxExtraBalls?: number;
}

export interface RulesDismissals {
  bowlerCredits: string[];
  fielderCredits: string[];
  runOutNoBowlerWicket: boolean;
  pairContinuesAfterWicket: boolean;
  /** London U9 pairs: swap strike after each wicket (pair continues batting). */
  rotateStrikeAfterWicket?: boolean;
}

export interface RulesDisplay {
  netRunsFormula: string;
  showStartingScoreInTotal: boolean;
  economyGoodThreshold: number;
  economyBadThreshold: number;
}

/** How a mid-tournament rule change is applied. */
export type RuleChangeMode = "FUTURE_ONLY" | "BACKFILL";

export interface DeliveryEvent {
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
  runsOffBat: number;
  extrasType?:
    | "wide"
    | "no_ball"
    | "bye"
    | "leg_bye"
    | "wide_runs"
    | "no_ball_runs";
  /** For wide_runs / no_ball_runs when extrasRuns are byes vs leg byes */
  extrasRunsType?: "bye" | "leg_bye";
  extrasRuns: number;
  wicketType?:
    | "bowled"
    | "caught"
    | "stumped"
    | "lbw"
    | "hit_wicket"
    | "run_out";
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  fielderId?: string;
  dismissedBatsmanId?: string;
}

export interface InningsConfig {
  playersPerSide: number;
  totalOvers: number;
}

export interface InningsState {
  config: InningsConfig;
  deliveries: DeliveryEvent[];
  totalRuns: number;
  wickets: number;
  batRuns: number;
  extras: number;
}

export interface InningsTotals {
  totalRuns: number;
  wickets: number;
  batRuns: number;
  netRuns: number;
  oversBowled: number;
}
