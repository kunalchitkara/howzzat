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
