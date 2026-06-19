import { getApiBase } from "./config";
import { getSessionToken, sessionCookieHeader } from "./session";

export function apiUrl(path: string): string {
  return `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

type ApiFetchInit = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { skipAuth, ...requestInit } = init ?? {};
  const authHeaders: Record<string, string> = {};
  if (!skipAuth) {
    const token = await getSessionToken();
    if (token) authHeaders.Cookie = sessionCookieHeader(token);
  }

  const res = await fetch(apiUrl(path), {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...requestInit.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const err = body?.error;
    const message =
      typeof err === "string"
        ? err
        : typeof err?.message === "string"
          ? err.message
          : typeof body?.message === "string"
            ? body.message
            : "Request failed";
    throw new Error(message);
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

export type U9DemoMatch = IosDemoMatch & {
  startingScore: number;
  wicketPenalty: number;
  playersPerSide: number;
  rosterSize: number;
};

export async function createIosDemoMatch() {
  return apiFetch<IosDemoMatch>("/api/v1/demo/ios-match", { method: "POST" });
}

export async function createU9DemoMatch() {
  return apiFetch<U9DemoMatch>("/api/v1/demo/u9-match", { method: "POST" });
}

export type ScoringPlayer = {
  id: string;
  name: string;
  teamId: string;
  isCaptain?: boolean;
};

export type TossInfo = {
  tossWinnerTeamId: string | null;
  tossWinnerName: string | null;
  electedTo: string | null;
  tossCallerPlayerId: string | null;
  tossCallerName: string | null;
  battingFirstTeamId: string | null;
};

export type RecentBallBubble = {
  id: string;
  symbol: string;
  overNumber: number;
  isOverEnd: boolean;
};

export type ScoringContext = {
  status: string;
  hostTeamId: string;
  squadsConfirmed: boolean;
  canReopenSquads: boolean;
  chaseContinuedAfterTarget: boolean;
  playersPerSide: number;
  squadMin: number;
  squadMax: number;
  matchTotalOvers: number | null;
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
    displayOvers: string;
    complete: boolean;
    nextBall: { overNumber: number; ballInOver: number };
    lastBall: { overNumber: number; ballInOver: number } | null;
    recentBalls: RecentBallBubble[];
    bowlerLocked: boolean;
    lockedBowlerId: string | null;
  }[];
  rotateStrikeAfterWicket: boolean;
  wicketPenalty: number;
  activeInningsId: string | null;
  canStartInnings: { inningsNumber: number; battingTeamId: string; label: string } | null;
  canFinalize: boolean;
  chase: {
    targetRuns: number;
    runsNeeded: number;
    defendingTeamId: string;
    chasingTeamId: string;
    targetReached: boolean;
  } | null;
  suggestedResult: { line: string; hostWon: boolean } | null;
  scoringLock: {
    requiresAuth: boolean;
    needsSignIn: boolean;
    canScore: boolean;
    lockedByOther: boolean;
    isHolder: boolean;
    holderUserId: string | null;
    holderName: string | null;
    claimedAt: string | null;
  };
};

export async function claimScoring(matchId: string) {
  return apiFetch<ScoringContext>(`/api/v1/matches/${matchId}/scoring/claim`, {
    method: "POST",
  });
}

export async function saveSquad(
  matchId: string,
  body: { teamId: string; playerIds: string[]; captainId?: string },
) {
  return apiFetch(`/api/v1/matches/${matchId}/squad`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reopenSquads(matchId: string) {
  return apiFetch(`/api/v1/matches/${matchId}/squad/reopen`, { method: "POST" });
}

export async function confirmSquads(matchId: string, totalOvers: number) {
  return apiFetch<{ squadsConfirmedAt: string }>(
    `/api/v1/matches/${matchId}/squad/confirm`,
    {
      method: "POST",
      body: JSON.stringify({ totalOvers }),
    },
  );
}

export type ScorerInvitePreview = {
  token: string;
  matchId: string;
  email: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  matchTitle: string;
};

export async function fetchScorerInvite(token: string) {
  return apiFetch<ScorerInvitePreview>(`/api/v1/scorer-invites/${token}`);
}

export async function acceptScorerInvite(token: string) {
  return apiFetch<{ matchId: string; acceptedAt: string | null }>(
    `/api/v1/scorer-invites/${token}/accept`,
    { method: "POST" },
  );
}

export async function endInningsEarly(matchId: string, inningsId: string) {
  return apiFetch(`/api/v1/matches/${matchId}/innings/${inningsId}/end`, {
    method: "POST",
  });
}

export async function continueChase(matchId: string) {
  return apiFetch<{ chaseContinuedAfterTarget: boolean }>(
    `/api/v1/matches/${matchId}/chase/continue`,
    { method: "POST" },
  );
}

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
