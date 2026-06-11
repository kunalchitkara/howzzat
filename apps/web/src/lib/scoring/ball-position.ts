export interface BallPosition {
  overNumber: number;
  ballInOver: number;
}

export interface DeliveryBallInput {
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
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

  let over = last.overNumber;
  let ball = last.ballInOver + 1;
  if (ball > 6) {
    over += 1;
    ball = 1;
  }
  if (over > totalOvers) {
    return { overNumber: totalOvers, ballInOver: 6 };
  }
  return { overNumber: over, ballInOver: ball };
}

export function countLegalBalls(
  deliveries: { isLegalBall: boolean }[],
): number {
  return deliveries.filter((d) => d.isLegalBall).length;
}

export function maxLegalBalls(totalOvers: number): number {
  return totalOvers * 6;
}

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
  const spareBalls = totalOvers * 6 - legalBallsBowled;
  return formatOversFromLegalBalls(Math.max(0, spareBalls));
}

export function formatOver(position: BallPosition): string {
  return `${position.overNumber}.${position.ballInOver}`;
}

/** Bowler is fixed once any delivery has been recorded in the current over. */
export function currentOverBowler(
  deliveries: { overNumber: number; bowlerId: string }[],
  nextBall: BallPosition,
): { locked: boolean; bowlerId: string | null } {
  const inOver = deliveries.filter((d) => d.overNumber === nextBall.overNumber);
  if (inOver.length === 0) return { locked: false, bowlerId: null };
  return { locked: true, bowlerId: inOver[inOver.length - 1]!.bowlerId };
}
