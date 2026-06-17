import type { DeliveryEvent, RulesProfile } from "./types.js";

function isWideExtra(
  extrasType: DeliveryEvent["extrasType"],
): extrasType is "wide" | "wide_runs" {
  return extrasType === "wide" || extrasType === "wide_runs";
}

function isNoBallExtra(
  extrasType: DeliveryEvent["extrasType"],
): extrasType is "no_ball" | "no_ball_runs" {
  return extrasType === "no_ball" || extrasType === "no_ball_runs";
}

/** Whether a wide or no-ball is rebowled (does not count toward the over). */
export function extraRebowls(
  profile: RulesProfile,
  extrasType: DeliveryEvent["extrasType"],
  overNumber: number,
  totalOvers: number,
): boolean {
  if (!extrasType) return false;
  const isLastOver = overNumber >= totalOvers;
  if (isWideExtra(extrasType)) {
    const block = profile.scoring.wide;
    return (isLastOver ? block.lastOver : block.default).rebowl;
  }
  if (isNoBallExtra(extrasType)) {
    const block = profile.scoring.noBall;
    return (isLastOver ? block.lastOver : block.default).rebowl;
  }
  return false;
}

/**
 * Whether a delivery counts as one of the six balls in the over.
 * Non-rebowl wides/no-balls count (U9 default); rebowled extras do not.
 */
export function deliveryCountsTowardOver(
  delivery: Pick<DeliveryEvent, "isLegalBall" | "extrasType" | "overNumber">,
  profile: RulesProfile,
  totalOvers: number,
): boolean {
  if (delivery.isLegalBall) return true;
  if (!delivery.extrasType) return false;
  return !extraRebowls(profile, delivery.extrasType, delivery.overNumber, totalOvers);
}

/** Resolve persisted `isLegalBall` from rules profile (server authority). */
export function resolveDeliveryIsLegalBall(
  delivery: Pick<DeliveryEvent, "extrasType" | "overNumber">,
  profile: RulesProfile,
  totalOvers: number,
  clientIsLegal = true,
): boolean {
  if (isWideExtra(delivery.extrasType) || isNoBallExtra(delivery.extrasType)) {
    return !extraRebowls(
      profile,
      delivery.extrasType,
      delivery.overNumber,
      totalOvers,
    );
  }
  return clientIsLegal;
}

export function countOverProgressBalls(
  deliveries: Pick<DeliveryEvent, "isLegalBall" | "extrasType" | "overNumber">[],
  profile: RulesProfile,
  totalOvers: number,
): number {
  return deliveries.filter((d) =>
    deliveryCountsTowardOver(d, profile, totalOvers),
  ).length;
}

export function isEndOfOverDelivery(
  delivery: Pick<
    DeliveryEvent,
    "isLegalBall" | "extrasType" | "overNumber" | "ballInOver"
  >,
  profile: RulesProfile,
  totalOvers: number,
): boolean {
  return (
    delivery.ballInOver === 6 &&
    deliveryCountsTowardOver(delivery, profile, totalOvers)
  );
}
