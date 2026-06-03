import type { BatterRow } from "@/lib/scorecard/types";

function netClass(net: number) {
  if (net > 0) return "sc-net-pos";
  if (net < 0) return "sc-net-neg";
  return "";
}

export function BattingTable({
  batters,
  showNet = true,
}: {
  batters: BatterRow[];
  showNet?: boolean;
}) {
  return (
    <div className="sc-table-wrap">
      <table className="sc-bat-table">
        <thead>
          <tr>
            <th>Batter</th>
            <th className="num">R</th>
            <th className="num">B</th>
            <th className="num">4s</th>
            <th className="num">6s</th>
            {showNet && <th className="num">Net</th>}
            <th className="num" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {batters.map((b) => (
            <tr key={b.playerId}>
              <td className="sc-batter-cell">
                <div className="sc-batter-name">{b.name}</div>
                <div className="sc-batter-dismissal">{b.dismissal}</div>
              </td>
              <td className="num">
                <span className="sc-runs">{b.runs}</span>
              </td>
              <td className="num">{b.balls || "—"}</td>
              <td className="num">{b.fours || "—"}</td>
              <td className="num">{b.sixes || "—"}</td>
              {showNet && (
                <td className={`num ${netClass(b.netRuns)}`}>
                  {b.netRuns > 0 ? `+${b.netRuns}` : b.netRuns}
                </td>
              )}
              <td className="num sc-chevron" aria-hidden="true">
                ›
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
