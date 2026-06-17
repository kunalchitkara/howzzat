import {
  resolveDeliveryIsLegalBall,
  type DeliveryEvent,
  type RulesProfile,
} from "@howzzat/rules-engine";
import type { MatchScoringContext } from "./types";

type ExtrasScoring = MatchScoringContext["extrasScoring"];

function asProfileSlice(extras: ExtrasScoring): RulesProfile {
  return {
    scoring: {
      wide: extras.wide,
      noBall: extras.noBall,
    },
  } as RulesProfile;
}

export function resolveScoringIsLegalBall(
  delivery: Pick<DeliveryEvent, "overNumber" | "extrasType">,
  extras: ExtrasScoring,
  totalOvers: number,
  clientIsLegal = true,
): boolean {
  return resolveDeliveryIsLegalBall(
    delivery,
    asProfileSlice(extras),
    totalOvers,
    clientIsLegal,
  );
}
