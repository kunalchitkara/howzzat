import { getApiBase } from "./config";

export function apiUrl(path: string): string {
  return `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error?.message ?? body?.error ?? "Request failed";
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  return body.data as T;
}

export type IosDemoMatch = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  totalOvers: number;
  reset: boolean;
};

export async function createIosDemoMatch() {
  return apiFetch<IosDemoMatch>("/api/v1/demo/ios-match", { method: "POST" });
}

export type ScoringPlayer = { id: string; name: string; teamId: string };

export type TossInfo = {
  tossWinnerTeamId: string | null;
  tossWinnerName: string | null;
  electedTo: string | null;
  tossCallerPlayerId: string | null;
  tossCallerName: string | null;
  battingFirstTeamId: string | null;
};

export type ScoringContext = {
  status: string;
  homeTeam: { id: string; name: string; teamId: string };
  awayTeam: { id: string; name: string; teamId: string };
  totalOvers: number;
  startingScore: number;
  squads: { home: ScoringPlayer[]; away: ScoringPlayer[] };
  rosters: { home: ScoringPlayer[]; away: ScoringPlayer[] };
  toss: TossInfo;
  innings: {
    id: string;
    inningsNumber: number;
    battingTeamId: string;
    battingTeamName: string;
    bowlingTeamName: string;
    totalRuns: number;
    wickets: number;
    oversBowled: number;
    complete: boolean;
    nextBall: { overNumber: number; ballInOver: number };
    bowlerLocked: boolean;
    lockedBowlerId: string | null;
  }[];
  rotateStrikeAfterWicket: boolean;
  wicketPenalty: number;
  activeInningsId: string | null;
  canStartInnings: { inningsNumber: number; battingTeamId: string; label: string } | null;
  canFinalize: boolean;
};

export type MatchScorecardView = {
  matchTitle: string;
  status: string;
  resultBanner?: { text: string; subtext?: string };
  innings: {
    teamName: string;
    totalRuns: number;
    wickets: number;
    overs: number;
    netRuns: number;
    batters: { playerId: string; name: string; runs: number; balls: number }[];
    bowlers: { playerId: string; name: string; overs: number; runs: number; wickets: number }[];
    partnerships: {
      label: string;
      batter1: string;
      batter2: string;
      runs: number;
      wickets: number;
    }[];
  }[];
  ballByBall?: {
    innings: {
      teamName: string;
      overs: {
        overNumber: number;
        partnershipLabel: string;
        partnershipRuns: number;
        deliveries: { symbol: string; displayBall: string }[];
      }[];
    }[];
  };
};

export async function fetchScoringContext(matchId: string) {
  return apiFetch<ScoringContext>(`/api/v1/matches/${matchId}/scoring`);
}

export async function fetchScorecard(matchId: string) {
  const data = await apiFetch<{ view: MatchScorecardView }>(
    `/api/v1/matches/${matchId}/scorecard`,
  );
  return data.view;
}

export async function recordToss(
  matchId: string,
  body: {
    tossWinnerTeamId: string;
    tossCallerPlayerId?: string;
    electedTo: "bat" | "bowl";
  },
) {
  return apiFetch<{ battingFirstId: string }>(`/api/v1/matches/${matchId}/toss`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
