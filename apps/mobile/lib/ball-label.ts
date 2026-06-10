/** MJCA-style ball labels: 0.1–0.5, 1.0, 1.1–1.5, 2.0, … */
export function formatBallLabel(overNumber: number, ballInOver: number): string {
  if (ballInOver >= 6) return `${overNumber}.0`;
  return `${overNumber - 1}.${ballInOver}`;
}
