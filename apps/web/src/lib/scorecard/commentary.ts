import type { BallByBallInnings, BallByBallOver, MatchBallByBall } from "./types";

export interface CommentaryMoment {
  ball: string;
  text: string;
  kind: "wicket" | "boundary" | "runs" | "extra";
}

export interface OverCommentary {
  overNumber: number;
  displayOver: string;
  bowlerName: string;
  batterLine: string;
  partnershipLine: string;
  summary: string;
  scoreAtEnd: string;
  moments: CommentaryMoment[];
}

export interface InningsCommentary {
  label: string;
  teamName: string;
  overs: OverCommentary[];
}

export interface MatchCommentary {
  innings: InningsCommentary[];
}

export function formatOverSummary(over: BallByBallOver): string {
  if (over.runs === 0 && over.wickets === 0) return "Maiden over";
  const parts: string[] = [];
  parts.push(`${over.runs} run${over.runs === 1 ? "" : "s"} off the over`);
  if (over.wickets > 0) {
    parts.push(`${over.wickets} wicket${over.wickets === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function extractKeyMoments(over: BallByBallOver): CommentaryMoment[] {
  const moments: CommentaryMoment[] = [];
  for (const d of over.deliveries) {
    if (d.isWicket) {
      moments.push({
        ball: d.displayBall,
        text: `Wicket! ${d.description}`,
        kind: "wicket",
      });
      continue;
    }
    if (d.symbol === "4" || d.symbol === "6") {
      moments.push({
        ball: d.displayBall,
        text: d.description,
        kind: "boundary",
      });
      continue;
    }
    if (!d.isLegalBall) {
      moments.push({
        ball: d.displayBall,
        text: d.description,
        kind: "extra",
      });
      continue;
    }
    if (d.runsAdded >= 3) {
      moments.push({
        ball: d.displayBall,
        text: d.description,
        kind: "runs",
      });
    }
  }
  return moments;
}

function formatBatterLine(over: BallByBallOver): string {
  if (!over.batterSummaries.length) return "";
  return over.batterSummaries
    .map((b) => `${b.name} ${b.runs}${b.isStriker ? "*" : ""} (${b.balls})`)
    .join(" · ");
}

function formatPartnershipLine(over: BallByBallOver): string {
  if (!over.partnershipLabel) return "";
  let line = `${over.partnershipLabel}: ${over.partnershipRuns >= 0 ? "+" : ""}${over.partnershipRuns}`;
  if (over.partnershipWickets > 0) {
    line += ` (${over.partnershipWickets} wkt)`;
  }
  return line;
}

export function buildOverCommentary(over: BallByBallOver): OverCommentary {
  const last = over.deliveries[over.deliveries.length - 1];
  const bowlerName = over.deliveries[0]?.bowlerName ?? "";

  return {
    overNumber: over.overNumber,
    displayOver: over.displayOver,
    bowlerName,
    batterLine: formatBatterLine(over),
    partnershipLine: formatPartnershipLine(over),
    summary: formatOverSummary(over),
    scoreAtEnd: last ? `${last.totalScore}-${last.wickets}` : "",
    moments: extractKeyMoments(over),
  };
}

export function buildInningsCommentary(innings: BallByBallInnings): InningsCommentary {
  return {
    label: innings.label,
    teamName: innings.teamName,
    overs: innings.overs.map(buildOverCommentary).reverse(),
  };
}

export function buildMatchCommentary(ballByBall: MatchBallByBall): MatchCommentary {
  return {
    innings: ballByBall.innings.map(buildInningsCommentary),
  };
}
