export interface ScoringPlayer {
  id: string;
  name: string;
  teamId: string;
  dateOfBirth?: string | null;
  ageOnMatchDay?: number | null;
  /** Older than tournament age band (e.g. 10+ in U9). */
  overAge?: boolean;
  isCaptain?: boolean;
}

export interface RecentBallBubble {
  id: string;
  symbol: string;
  overNumber: number;
  ballInOver: number;
  isOverEnd: boolean;
}

export interface ScoringDeliveryView {
  id: string;
  sequence: number;
  overNumber: number;
  ballInOver: number;
  symbol: string;
  runsOffBat: number;
  isLegalBall: boolean;
  extrasType: string | null;
  extrasRuns: number;
  extrasRunsType: string | null;
  wicketType: string | null;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  fielderId: string | null;
  dismissedBatsmanId: string | null;
}

export interface ScoringInningsView {
  id: string;
  inningsNumber: number;
  battingTeamId: string;
  battingTeamName: string;
  bowlingTeamName: string;
  totalRuns: number;
  wickets: number;
  batRuns: number;
  netRuns: number;
  oversBowled: number;
  legalBallsBowled: number;
  displayOvers: string;
  deliveryCount: number;
  complete: boolean;
  nextBall: { overNumber: number; ballInOver: number };
  /** Last ball bowled — use for live scoreboard display. */
  lastBall: { overNumber: number; ballInOver: number } | null;
  recentBalls: RecentBallBubble[];
  deliveries: ScoringDeliveryView[];
  /** True once any ball (incl. wides/nb) has been bowled this over. */
  bowlerLocked: boolean;
  lockedBowlerId: string | null;
}

export interface ChaseInfo {
  targetRuns: number;
  runsNeeded: number;
  defendingTeamId: string;
  chasingTeamId: string;
  targetReached: boolean;
}

export interface TossInfo {
  tossWinnerTeamId: string | null;
  tossWinnerName: string | null;
  electedTo: string | null;
  tossCallerPlayerId: string | null;
  tossCallerName: string | null;
  battingFirstTeamId: string | null;
}

export interface SuggestedResult {
  line: string;
  hostWon: boolean;
}

export interface ScoringLockInfo {
  requiresAuth: boolean;
  canScore: boolean;
  lockedByOther: boolean;
  isHolder: boolean;
  holderUserId: string | null;
  holderName: string | null;
  claimedAt: string | null;
}

export interface MatchScoringContext {
  matchId: string;
  status: string;
  /** Home team is the host / managing club side. */
  hostTeamId: string;
  squadsConfirmed: boolean;
  /** Squads and toss can be revised until the first innings begins. */
  canReopenSquads: boolean;
  chaseContinuedAfterTarget: boolean;
  toss: TossInfo;
  homeTeam: { id: string; name: string; teamId: string };
  awayTeam: { id: string; name: string; teamId: string };
  venue?: string;
  playersPerSide: number;
  /** Minimum players required per side (from rules profile). */
  squadMin: number;
  /** Maximum players allowed per side (from rules profile). */
  squadMax: number;
  totalOvers: number;
  /** Overs saved on the match (set at squad confirm). */
  matchTotalOvers: number | null;
  pairOvers: number;
  startingScore: number;
  wicketPenalty: number;
  rotateStrikeAfterWicket: boolean;
  /** Wide/no-ball rebowl flags — drives whether extras count toward the over. */
  extrasScoring: {
    wide: { default: { rebowl: boolean }; lastOver: { rebowl: boolean } };
    noBall: { default: { rebowl: boolean }; lastOver: { rebowl: boolean } };
  };
  tournamentAgeGroup: string | null;
  squads: {
    home: ScoringPlayer[];
    away: ScoringPlayer[];
  };
  /** Full org team rosters — source for add-to-match squad. */
  rosters: {
    home: ScoringPlayer[];
    away: ScoringPlayer[];
  };
  innings: ScoringInningsView[];
  activeInningsId: string | null;
  canStartInnings: {
    inningsNumber: number;
    battingTeamId: string;
    label: string;
    /** Set when chasing (2nd innings): first-innings total + 1. */
    targetRuns?: number;
  } | null;
  canFinalize: boolean;
  chase: ChaseInfo | null;
  suggestedResult: SuggestedResult | null;
  scoringLock: ScoringLockInfo;
}
