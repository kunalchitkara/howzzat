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
  deliveryCount: number;
  complete: boolean;
  nextBall: { overNumber: number; ballInOver: number };
  /** True once any ball (incl. wides/nb) has been bowled this over. */
  bowlerLocked: boolean;
  lockedBowlerId: string | null;
}

export interface TossInfo {
  tossWinnerTeamId: string | null;
  tossWinnerName: string | null;
  electedTo: string | null;
  tossCallerPlayerId: string | null;
  tossCallerName: string | null;
  battingFirstTeamId: string | null;
}

export interface MatchScoringContext {
  matchId: string;
  status: string;
  toss: TossInfo;
  homeTeam: { id: string; name: string; teamId: string };
  awayTeam: { id: string; name: string; teamId: string };
  venue?: string;
  playersPerSide: number;
  totalOvers: number;
  pairOvers: number;
  startingScore: number;
  wicketPenalty: number;
  rotateStrikeAfterWicket: boolean;
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
  canStartInnings: { inningsNumber: number; battingTeamId: string; label: string } | null;
  canFinalize: boolean;
}
