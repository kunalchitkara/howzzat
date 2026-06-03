import type { DeliveryEvent } from "./types.js";

/** Whether striker and non-striker swap ends after runs on this delivery. */
export function shouldRotateStrike(event: DeliveryEvent): boolean {
  if (event.runsOffBat > 0 && event.runsOffBat % 2 === 1) {
    if (
      !event.extrasType ||
      event.extrasType === "no_ball" ||
      event.extrasType === "no_ball_runs"
    ) {
      return true;
    }
  }

  if (event.isLegalBall) {
    if (
      (event.extrasType === "bye" || event.extrasType === "leg_bye") &&
      event.extrasRuns % 2 === 1
    ) {
      return true;
    }
  }

  if (
    (event.extrasType === "wide_runs" || event.extrasType === "no_ball_runs") &&
    event.runsOffBat === 0 &&
    event.extrasRuns % 2 === 1
  ) {
    return true;
  }

  return false;
}

export function rotateStrikePair<T>(striker: T, nonStriker: T): [T, T] {
  return [nonStriker, striker];
}

/** Apply all strike rotations after a delivery (runs, end of over, U9 wicket rule). */
export function applyStrikeRotationsAfterDelivery<T>(
  striker: T,
  nonStriker: T,
  event: DeliveryEvent,
  options: { rotateStrikeAfterWicket?: boolean } = {},
): [T, T] {
  let s = striker;
  let ns = nonStriker;

  if (shouldRotateStrike(event)) {
    [s, ns] = rotateStrikePair(s, ns);
  }

  if (event.isLegalBall && event.ballInOver === 6) {
    [s, ns] = rotateStrikePair(s, ns);
  }

  if (event.wicketType && options.rotateStrikeAfterWicket) {
    [s, ns] = rotateStrikePair(s, ns);
  }

  return [s, ns];
}
