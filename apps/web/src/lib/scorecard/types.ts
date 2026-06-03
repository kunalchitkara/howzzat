export interface PlayerInfo {
  id: string;
  name: string;
  displayName?: string;
}

export interface BatterRow {
  playerId: string;
  name: string;
  dismissal: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  netRuns: number;
  wicketsLost: number;
  isNotOut: boolean;
}

export interface BowlerRow {
  playerId: string;
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  dots: number;
  economy: number;
}

export interface FallOfWicket {
  wicket: number;
  score: number;
  batterName: string;
  over: number;
  ball: number;
  dismissal: string;
}

export interface PartnershipRow {
  label: string;
  batter1: string;
  batter2: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  netRuns: number;
}

export interface FieldingRow {
  fielderName: string;
  catches: number;
  runOuts: number;
  details: string[];
}

export interface ExtrasBreakdown {
  total: number;
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface InningsScorecardView {
  teamName: string;
  inningsLabel: string;
  totalRuns: number;
  wickets: number;
  overs: number;
  batRuns: number;
  netRuns: number;
  startingScore: number;
  batRunsFromPlay: number;
  extras: ExtrasBreakdown;
  batters: BatterRow[];
  bowlers: BowlerRow[];
  fallOfWickets: FallOfWicket[];
  partnerships: PartnershipRow[];
  fielding: FieldingRow[];
}

export interface MatchScorecardView {
  matchTitle: string;
  venue?: string;
  date?: string;
  status: string;
  resultBanner?: {
    text: string;
    subtext?: string;
    variant: "win" | "loss" | "draw" | "neutral";
  };
  innings: InningsScorecardView[];
  ballByBall?: MatchBallByBall;
  rulesNote?: string;
}

export interface BallByBallDelivery {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  displayBall: string;
  symbol: string;
  description: string;
  strikerName: string;
  bowlerName: string;
  runsAdded: number;
  totalScore: number;
  wickets: number;
  isWicket: boolean;
  isLegalBall: boolean;
}

export interface OverBatterSummary {
  name: string;
  runs: number;
  balls: number;
  /** On strike at end of this over */
  isStriker: boolean;
}

export interface BallByBallOver {
  overNumber: number;
  /** Zero-based over label shown in UI (over 1 → "0") */
  displayOver: string;
  runs: number;
  wickets: number;
  deliveries: BallByBallDelivery[];
  batterSummaries: OverBatterSummary[];
  partnershipLabel: string;
  partnershipRuns: number;
  partnershipWickets: number;
}

export interface BallByBallInnings {
  teamName: string;
  label: string;
  overs: BallByBallOver[];
}

export interface MatchBallByBall {
  innings: BallByBallInnings[];
}
