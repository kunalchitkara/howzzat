/** Slim API response after recording a delivery — avoids full scoring context refetch. */
export interface RecordDeliveryResponse {
  deliveryId: string;
  clientDeliveryId?: string | null;
  innings: {
    runs: number;
    wickets: number;
    legalBalls: number;
    overDisplay: string;
    batRuns: number;
    netRuns: number;
    complete: boolean;
  };
  nextBall: { overNumber: number; ballInOver: number };
  endOfOver: boolean;
  chase?: {
    targetRuns: number;
    runsNeeded: number;
    targetReached: boolean;
  } | null;
}
