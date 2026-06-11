import {
  applyStrikeRotationsAfterDelivery,
  type DeliveryEvent,
} from "@howzzat/rules-engine";

/** Striker and non-striker after replaying all deliveries in order. */
export function strikeAfterDeliveries(
  deliveries: DeliveryEvent[],
  options: { rotateStrikeAfterWicket?: boolean } = {},
): { strikerId: string; nonStrikerId: string } | null {
  if (!deliveries.length) return null;
  let strikerId = deliveries[0]!.strikerId;
  let nonStrikerId = deliveries[0]!.nonStrikerId;
  for (const event of deliveries) {
    [strikerId, nonStrikerId] = applyStrikeRotationsAfterDelivery(
      strikerId,
      nonStrikerId,
      event,
      options,
    );
  }
  return { strikerId, nonStrikerId };
}
