import { countLegalBalls, oversToSpare } from "./ball-position";

export interface InningsResultInput {
  battingTeamId: string;
  totalRuns: number;
  deliveries: { isLegalBall: boolean }[];
}

export interface HostResultInput {
  hostTeamId: string;
  hostTeamName: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  innings: InningsResultInput[];
  totalOvers: number;
  chaseContinuedAfterTarget: boolean;
}

function teamName(
  teamId: string,
  home: { id: string; name: string },
  away: { id: string; name: string },
): string {
  if (teamId === home.id) return home.name;
  if (teamId === away.id) return away.name;
  return "Team";
}

/** Result line from the host (home) manager's perspective. */
export function buildHostResultLine(input: HostResultInput): string | null {
  if (input.innings.length < 2) return null;

  const [first, second] = input.innings;
  if (!first || !second) return null;

  const target = first.totalRuns + 1;
  const chasingWon = second.totalRuns >= target;
  const hostChased = second.battingTeamId === input.hostTeamId;
  const hostDefended = first.battingTeamId === input.hostTeamId;

  const home = { id: input.homeTeamId, name: input.homeTeamName };
  const away = { id: input.awayTeamId, name: input.awayTeamName };

  if (chasingWon) {
    const chasingName = teamName(second.battingTeamId, home, away);

    if (hostChased) {
      if (input.chaseContinuedAfterTarget) {
        const margin = second.totalRuns - first.totalRuns;
        return `${input.hostTeamName} won by ${margin} runs`;
      }
      const legal = countLegalBalls(second.deliveries);
      const spare = oversToSpare(input.totalOvers, legal);
      return `${input.hostTeamName} won with ${spare} overs to spare`;
    }

    const margin = second.totalRuns - first.totalRuns;
    if (input.chaseContinuedAfterTarget) {
      return `${chasingName} won by ${margin} runs`;
    }
    const legal = countLegalBalls(second.deliveries);
    const spare = oversToSpare(input.totalOvers, legal);
    return `${chasingName} won with ${spare} overs to spare`;
  }

  if (hostDefended) {
    const margin = first.totalRuns - second.totalRuns;
    return `${input.hostTeamName} won by ${margin} runs`;
  }

  const defendingName = teamName(first.battingTeamId, home, away);
  const margin = first.totalRuns - second.totalRuns;
  return `${defendingName} won by ${margin} runs`;
}
