/** Platform default: 20p per player per match (both teams). */
export const DEFAULT_FEE_PER_PLAYER_PENCE = 20;

/** Suggested wallet top-up amounts in pence. */
export const WALLET_TOP_UP_AMOUNTS_PENCE = [1000, 2000, 5000] as const;

export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function matchChargePence(playerCount: number, ratePence: number): number {
  return playerCount * ratePence;
}
