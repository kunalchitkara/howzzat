import { deliverySymbol } from "./delivery-symbol";

export interface RecentBallBubble {
  id: string;
  symbol: string;
  overNumber: number;
  /** True after the 6th legal ball of an over (over separator). */
  isOverEnd: boolean;
}

export function buildRecentBalls(
  deliveries: {
    id: string;
    overNumber: number;
    ballInOver: number;
    isLegalBall: boolean;
    runsOffBat: number;
    extrasType: string | null;
    extrasRuns: number;
    extrasRunsType?: string | null;
    wicketType: string | null;
  }[],
  limit = 15,
): RecentBallBubble[] {
  const slice = deliveries.slice(-limit);
  return slice.map((d, i) => {
    const next = slice[i + 1];
    const isOverEnd =
      d.isLegalBall &&
      d.ballInOver === 6 &&
      (!next || next.overNumber !== d.overNumber);
    return {
      id: d.id,
      symbol: deliverySymbol(d),
      overNumber: d.overNumber,
      ballInOver: d.ballInOver,
      isOverEnd,
    };
  });
}
