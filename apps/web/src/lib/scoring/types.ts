export interface ScoringPlayer {
  id: string;
  name: string;
  teamId: string;
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
}

export interface MatchScoringContext {
  matchId: string;
  status: string;
  homeTeam: { id: string; name: string; teamId: string };
  awayTeam: { id: string; name: string; teamId: string };
  venue?: string;
  playersPerSide: number;
  totalOvers: number;
  pairOvers: number;
  startingScore: number;
  wicketPenalty: number;
  rotateStrikeAfterWicket: boolean;
  squads: {
    home: ScoringPlayer[];
    away: ScoringPlayer[];
  };
  innings: ScoringInningsView[];
  activeInningsId: string | null;
  canStartInnings: { inningsNumber: number; battingTeamId: string; label: string } | null;
  canFinalize: boolean;
}
