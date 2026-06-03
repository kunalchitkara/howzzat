import type { BowlerRow } from "@/lib/scorecard/types";

function ecoClass(eco: number) {
  if (eco <= 4) return "sc-eco-good";
  if (eco >= 7) return "sc-eco-bad";
  return "";
}

export function BowlingTable({ bowlers }: { bowlers: BowlerRow[] }) {
  return (
    <div className="sc-table-wrap">
      <table className="sc-bowl-table">
        <thead>
          <tr>
            <th>Bowler</th>
            <th className="num">O</th>
            <th className="num">R</th>
            <th className="num">W</th>
            <th className="num">WD</th>
            <th className="num">NB</th>
            <th className="num">ECO</th>
            <th className="num">Dots</th>
          </tr>
        </thead>
        <tbody>
          {bowlers.map((b) => (
            <tr key={b.playerId}>
              <td>
                <span className="sc-batter-name">{b.name}</span>
              </td>
              <td className="num">{b.overs.toFixed(1)}</td>
              <td className="num">{b.runs}</td>
              <td className="num">
                <strong>{b.wickets || "—"}</strong>
              </td>
              <td className="num">{b.wides || "—"}</td>
              <td className="num">{b.noBalls || "—"}</td>
              <td className={`num ${ecoClass(b.economy)}`}>
                {b.economy.toFixed(1)}
              </td>
              <td className="num">{b.dots || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
