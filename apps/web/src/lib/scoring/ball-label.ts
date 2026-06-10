/** MJCA-style ball labels: 0.1–0.5, 1.0, 1.1–1.5, 2.0, … */
export function formatBallLabel(overNumber: number, ballInOver: number): string {
  if (ballInOver >= 6) return `${overNumber}.0`;
  return `${overNumber - 1}.${ballInOver}`;
}

/** Display over heading as 1st Over, 2nd Over, … */
export function formatOverHeading(overNumber: number): string {
  const mod100 = overNumber % 100;
  const mod10 = overNumber % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${overNumber}${suffix} Over`;
}
