/** Compact ball symbol for live scorer history bubbles. */
export function deliverySymbol(d: {
  wicketType?: string | null;
  extrasType?: string | null;
  extrasRuns?: number;
  extrasRunsType?: string | null;
  runsOffBat?: number;
}): string {
  if (d.wicketType) return "W";
  if (d.extrasType === "wide") return "Wd";
  if (d.extrasType === "wide_runs") return `Wd+${d.extrasRuns ?? 0}`;
  if (d.extrasType === "no_ball") {
    const bat = Number(d.runsOffBat ?? 0);
    return bat > 0 ? `Nb+${bat}` : "Nb";
  }
  if (d.extrasType === "no_ball_runs") {
    const suffix = d.extrasRunsType === "leg_bye" ? "lb" : "b";
    return `Nb+${d.extrasRuns ?? 0}${suffix}`;
  }
  if (d.extrasType === "bye") return `B${d.extrasRuns ?? 0}`;
  if (d.extrasType === "leg_bye") return `Lb${d.extrasRuns ?? 0}`;
  const runs = Number(d.runsOffBat ?? 0);
  return runs === 0 ? "·" : String(runs);
}
