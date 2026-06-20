export type MatchStatusSummary = {
  scheduled: number;
  played: number;
  ongoing: number;
  total: number;
};

export function summarizeMatchStatuses(
  matches: { status: string }[],
): MatchStatusSummary {
  let scheduled = 0;
  let played = 0;
  let ongoing = 0;

  for (const match of matches) {
    switch (match.status) {
      case "SCHEDULED":
        scheduled += 1;
        break;
      case "LIVE":
        ongoing += 1;
        break;
      case "COMPLETED":
      case "WALKOVER":
        played += 1;
        break;
      default:
        break;
    }
  }

  return { scheduled, played, ongoing, total: matches.length };
}

export function formatMatchStatusSummary(summary: MatchStatusSummary): string {
  if (summary.total === 0) return "No fixtures yet";
  const parts: string[] = [];
  if (summary.scheduled > 0) {
    parts.push(`${summary.scheduled} scheduled`);
  }
  if (summary.ongoing > 0) {
    parts.push(`${summary.ongoing} live`);
  }
  if (summary.played > 0) {
    parts.push(`${summary.played} played`);
  }
  return parts.length > 0 ? parts.join(" · ") : `${summary.total} fixtures`;
}

export function formatPlayerCount(count: number): string {
  return count === 1 ? "1 player" : `${count} players`;
}
