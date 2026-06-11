import type { RecentBallBubble } from "@/lib/scoring/types";

export function BallHistory({
  balls,
  onSelectBall,
  selectedBallId,
}: {
  balls: RecentBallBubble[];
  onSelectBall?: (deliveryId: string) => void;
  selectedBallId?: string | null;
}) {
  if (balls.length === 0) return null;

  const newestFirst = [...balls].reverse();

  return (
    <div className="sp-ball-history" aria-label="Recent balls">
      {newestFirst.map((b) => (
        <span key={b.id} className="sp-ball-history-wrap">
          <button
            type="button"
            className={`sp-ball-bubble${b.overNumber % 2 === 0 ? " even-over" : ""}${
              selectedBallId === b.id ? " selected" : ""
            }${onSelectBall ? " clickable" : ""}`}
            title={`Over ${b.overNumber}.${b.ballInOver} — tap to edit`}
            disabled={!onSelectBall}
            onClick={() => onSelectBall?.(b.id)}
          >
            {b.symbol}
          </button>
          {b.isOverEnd && <span className="sp-over-sep" aria-hidden />}
        </span>
      ))}
    </div>
  );
}
