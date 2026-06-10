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

export function isInningsComplete(
  deliveries: { isLegalBall: boolean }[],
  totalOvers: number,
): boolean {
  const legalBalls = deliveries.filter((d) => d.isLegalBall).length;
  return legalBalls >= totalOvers * 6;
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
