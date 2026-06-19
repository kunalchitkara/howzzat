export type SquadSideCounts = {
  homeTeamName: string;
  awayTeamName: string;
  homeCount: number;
  awayCount: number;
  min: number;
  max: number;
  homeRosterEmpty?: boolean;
  awayRosterEmpty?: boolean;
};

function playersWord(n: number): string {
  return n === 1 ? "player" : "players";
}

/** Coach-friendly hint for why Confirm lineups is disabled. */
export function describeLineupBlockers(input: SquadSideCounts): string {
  const {
    homeTeamName,
    awayTeamName,
    homeCount,
    awayCount,
    min,
    max,
    homeRosterEmpty,
    awayRosterEmpty,
  } = input;
  const parts: string[] = [];

  if (homeCount < min) {
    const needed = min - homeCount;
    if (homeCount === 0 && homeRosterEmpty) {
      parts.push(
        `${homeTeamName} needs ${min} ${playersWord(min)} — type names in Add player below`,
      );
    } else {
      parts.push(
        `${homeTeamName} needs ${needed} more ${playersWord(needed)} (${homeCount} of ${min} selected)`,
      );
    }
  } else if (homeCount > max) {
    parts.push(`${homeTeamName} has ${homeCount} selected — maximum is ${max}`);
  }

  if (awayCount < min) {
    const needed = min - awayCount;
    if (awayCount === 0 && awayRosterEmpty) {
      parts.push(
        `${awayTeamName} needs ${min} ${playersWord(min)} — type names in Add player below`,
      );
    } else {
      parts.push(
        `${awayTeamName} needs ${needed} more ${playersWord(needed)} (${awayCount} of ${min} selected)`,
      );
    }
  } else if (awayCount > max) {
    parts.push(`${awayTeamName} has ${awayCount} selected — maximum is ${max}`);
  }

  return parts.length > 0 ? `${parts.join(". ")}.` : "";
}

export function canConfirmLineup(
  homeCount: number,
  awayCount: number,
  min: number,
  max: number,
): boolean {
  return (
    homeCount >= min &&
    awayCount >= min &&
    homeCount <= max &&
    awayCount <= max
  );
}

/** API / confirm action error when squad counts fail validation. */
export function describeSquadConfirmError(
  input: SquadSideCounts,
): string {
  const message = describeLineupBlockers(input);
  if (message) return message;
  return "Each team needs the right number of players before you can continue.";
}
