import type { DeliveryEvent } from "@howzzat/rules-engine";

/** Shared delivery mapper for services and scorecard builder. */
export function deliveryToEvent(d: {
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
  runsOffBat: number;
  extrasType: string | null;
  extrasRuns: number;
  wicketType: string | null;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  fielderId: string | null;
  dismissedBatsmanId: string | null;
}): DeliveryEvent {
  return {
    overNumber: d.overNumber,
    ballInOver: d.ballInOver,
    isLegalBall: d.isLegalBall,
    runsOffBat: d.runsOffBat,
    extrasType: d.extrasType as DeliveryEvent["extrasType"],
    extrasRuns: d.extrasRuns,
    wicketType: d.wicketType as DeliveryEvent["wicketType"],
    strikerId: d.strikerId,
    nonStrikerId: d.nonStrikerId,
    bowlerId: d.bowlerId,
    fielderId: d.fielderId ?? undefined,
    dismissedBatsmanId: d.dismissedBatsmanId ?? undefined,
  };
}
