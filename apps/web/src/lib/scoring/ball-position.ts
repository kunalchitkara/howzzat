import {
  countOverProgressBalls,
  isEndOfOverDelivery,
  maxLegalBalls,
  type DeliveryEvent,
  type RulesProfile,
} from "@howzzat/rules-engine";

type OverProgressDelivery = Pick<
  DeliveryEvent,
  "overNumber" | "ballInOver" | "isLegalBall" | "extrasType"
>;

function toOverProgressDelivery(d: {
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
  extrasType?: string | null;
}): OverProgressDelivery {
  return {
    overNumber: d.overNumber,
    ballInOver: d.ballInOver,
    isLegalBall: d.isLegalBall,
    extrasType: (d.extrasType ?? undefined) as DeliveryEvent["extrasType"] | undefined,
  };
}

export interface BallPosition {
  overNumber: number;
  ballInOver: number;
}

export interface DeliveryBallInput {
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
}

function ballPositionForLegalIndex(index: number): BallPosition {
  return {
    overNumber: Math.floor(index / 6) + 1,
    ballInOver: (index % 6) + 1,
  };
}

export function nextBallAfterDeliveries(
  deliveries: DeliveryBallInput[],
  totalOvers: number,
): BallPosition {
  if (deliveries.length === 0) {
    return { overNumber: 1, ballInOver: 1 };
  }

  const last = deliveries[deliveries.length - 1]!;
  if (!last.isLegalBall) {
    return { overNumber: last.overNumber, ballInOver: last.ballInOver };
  }

  const legal = countLegalBalls(deliveries);
  const cap = maxLegalBalls(totalOvers);
  if (legal >= cap) {
    return ballPositionForLegalIndex(cap - 1);
  }

  return ballPositionForLegalIndex(legal);
}

export function countLegalBalls(
  deliveries: { isLegalBall: boolean }[],
): number {
  return deliveries.filter((d) => d.isLegalBall).length;
}

export { maxLegalBalls };

export function isInningsComplete(
  deliveries: { isLegalBall: boolean }[],
  totalOvers: number,
  endedAt?: Date | string | null,
): boolean {
  if (endedAt) return true;
  return countLegalBalls(deliveries) >= maxLegalBalls(totalOvers);
}

/** Whether another delivery may be recorded in this innings. */
export function canAcceptDelivery(
  deliveries: { isLegalBall: boolean }[],
  totalOvers: number,
  incomingIsLegal: boolean,
  endedAt?: Date | string | null,
): { ok: true } | { ok: false; reason: string } {
  if (endedAt) {
    return { ok: false, reason: "Innings already ended" };
  }
  const legal = countLegalBalls(deliveries);
  const cap = maxLegalBalls(totalOvers);
  if (legal >= cap) {
    return {
      ok: false,
      reason: `Innings complete (${totalOvers} overs)`,
    };
  }
  if (incomingIsLegal && legal + 1 > cap) {
    return {
      ok: false,
      reason: `Innings complete (${totalOvers} overs)`,
    };
  }
  return { ok: true };
}

/** Position of the last delivery bowled (for live display). */
export function lastBallAfterDeliveries(
  deliveries: DeliveryBallInput[],
): BallPosition | null {
  if (deliveries.length === 0) return null;
  const last = deliveries[deliveries.length - 1]!;
  return { overNumber: last.overNumber, ballInOver: last.ballInOver };
}

/** Cricket overs display e.g. 3 legal balls → 0.3, 7 → 1.1 */
export function formatOversFromLegalBalls(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

/** Overs (and balls) remaining in the innings e.g. 4 overs, 18 balls bowled → 1.0 */
export function oversToSpare(totalOvers: number, legalBallsBowled: number): string {
  const spareBalls = maxLegalBalls(totalOvers) - legalBallsBowled;
  return formatOversFromLegalBalls(Math.max(0, spareBalls));
}

export function formatOver(position: BallPosition): string {
  return `${position.overNumber}.${position.ballInOver}`;
}

export interface OverBowlerDelivery {
  overNumber: number;
  ballInOver: number;
  bowlerId: string;
  isLegalBall: boolean;
  extrasType?: string | null;
}

/** Bowler is fixed once any delivery has been recorded in the current over. */
export function currentOverBowler(
  deliveries: OverBowlerDelivery[],
  nextBall: BallPosition,
  options?: { profile?: RulesProfile; totalOvers?: number },
): { locked: boolean; bowlerId: string | null } {
  if (deliveries.length === 0) {
    return { locked: false, bowlerId: null };
  }

  const { profile, totalOvers } = options ?? {};
  if (profile && totalOvers != null) {
    const last = deliveries[deliveries.length - 1]!;
    const lastOverDeliveries = deliveries.filter(
      (d) => d.overNumber === last.overNumber,
    );
    const countingInLastOver = countOverProgressBalls(
      lastOverDeliveries.map(toOverProgressDelivery),
      profile,
      totalOvers,
    );
    if (countingInLastOver >= 6) {
      return { locked: false, bowlerId: null };
    }
    if (isEndOfOverDelivery(toOverProgressDelivery(last), profile, totalOvers)) {
      return { locked: false, bowlerId: null };
    }
  }

  const inOver = deliveries.filter((d) => d.overNumber === nextBall.overNumber);
  if (inOver.length === 0) return { locked: false, bowlerId: null };
  return { locked: true, bowlerId: inOver[inOver.length - 1]!.bowlerId };
}

/** Whether the delivery just recorded ended the over (for bowler pick / strike). */
export function deliveryEndedOver(
  delivery: Pick<
    OverBowlerDelivery,
    "overNumber" | "ballInOver" | "isLegalBall" | "extrasType"
  >,
  profile: RulesProfile,
  totalOvers: number,
): boolean {
  return isEndOfOverDelivery(toOverProgressDelivery(delivery), profile, totalOvers);
}
