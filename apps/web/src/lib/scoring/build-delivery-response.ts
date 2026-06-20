import { finalizeInnings, replayInnings, type RulesProfile } from "@howzzat/rules-engine";
import {
  countLegalBalls,
  deliveryEndedOver,
  formatOversFromLegalBalls,
  isInningsComplete,
  nextBallAfterDeliveries,
} from "@/lib/scoring/ball-position";
import { deliveryToEvent } from "@/lib/services/match-utils";
import type { RecordDeliveryResponse } from "@/lib/scoring/delivery-response";

type DeliveryRow = {
  id: string;
  clientDeliveryId?: string | null;
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
  runsOffBat: number;
  extrasType: string | null;
  extrasRuns: number;
  extrasRunsType?: string | null;
  wicketType: string | null;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  fielderId: string | null;
  dismissedBatsmanId: string | null;
};

type InningsRow = {
  inningsNumber: number;
  endedAt: Date | null;
  deliveries: DeliveryRow[];
};

export function buildRecordDeliveryResponse(input: {
  delivery: DeliveryRow;
  allDeliveries: DeliveryRow[];
  profile: RulesProfile;
  inningsConfig: { playersPerSide: number; totalOvers: number };
  innings: InningsRow;
  firstInningsTotalRuns?: number | null;
}): RecordDeliveryResponse {
  const { delivery, allDeliveries, profile, inningsConfig, innings, firstInningsTotalRuns } =
    input;

  const events = allDeliveries.map(deliveryToEvent);
  const state = replayInnings(profile, inningsConfig, events);
  const totals = finalizeInnings(state, profile);
  const legalBalls = countLegalBalls(allDeliveries);
  const complete = isInningsComplete(
    allDeliveries,
    inningsConfig.totalOvers,
    innings.endedAt,
  );
  const nextBall = nextBallAfterDeliveries(allDeliveries, inningsConfig.totalOvers);
  const endOfOver = deliveryEndedOver(
    {
      overNumber: delivery.overNumber,
      ballInOver: delivery.ballInOver,
      isLegalBall: delivery.isLegalBall,
      extrasType: delivery.extrasType,
    },
    profile,
    inningsConfig.totalOvers,
  );

  let chase: RecordDeliveryResponse["chase"] = null;
  if (innings.inningsNumber === 2 && firstInningsTotalRuns != null) {
    const targetRuns = firstInningsTotalRuns + 1;
    chase = {
      targetRuns,
      runsNeeded: Math.max(0, targetRuns - totals.totalRuns),
      targetReached: totals.totalRuns >= targetRuns,
    };
  }

  return {
    deliveryId: delivery.id,
    clientDeliveryId: delivery.clientDeliveryId,
    innings: {
      runs: totals.totalRuns,
      wickets: totals.wickets,
      legalBalls,
      overDisplay: complete
        ? `${inningsConfig.totalOvers}.0`
        : formatOversFromLegalBalls(legalBalls),
      batRuns: totals.batRuns,
      netRuns: totals.netRuns,
      complete,
    },
    nextBall,
    endOfOver,
    chase,
  };
}
