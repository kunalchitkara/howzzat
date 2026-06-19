import type {
  FallOfWicket,
  FieldingRow,
  InningsScorecardView,
  PartnershipRow,
} from "@/lib/scorecard/types";
import { BattingTable } from "./BattingTable";
import { BowlingTable } from "./BowlingTable";

function ExtrasTotal({ innings }: { innings: InningsScorecardView }) {
  const { extras, totalRuns, wickets, overs, batRunsFromPlay, startingScore } =
    innings;
  const extrasText =
    extras.total > 0
      ? `(w ${extras.wides}, nb ${extras.noBalls}, b ${extras.byes}, lb ${extras.legByes})`
      : "";

  return (
    <>
      {extras.total > 0 && (
        <table className="sc-bat-table">
          <tbody>
            <tr className="sc-extras-row">
              <td colSpan={7}>
                Extras <strong>{extras.total}</strong> {extrasText}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <table className="sc-bat-table">
        <tbody>
          <tr className="sc-total-row">
            <td colSpan={7}>
              Total{" "}
              <strong>
                {totalRuns} ({overs} Ov
              </strong>
              {startingScore > 0 && (
                <>
                  {" "}
                  · Base {startingScore} + {batRunsFromPlay} from play
                </>
              )}
              {wickets > 0 && <> · {wickets} wkts</>})
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function FallOfWickets({ items }: { items: FallOfWicket[] }) {
  if (!items.length) return null;
  return (
    <>
      <div className="sc-section-label">Fall of Wickets</div>
      <div className="sc-fow">
        {items.map((w) => (
          <span key={w.wicket} className="sc-fow-item">
            {w.score}-{w.wicket} ({w.batterName}, {w.over}.{w.ball} ov)
          </span>
        ))}
      </div>
    </>
  );
}

function PartnershipsTable({ rows }: { rows: PartnershipRow[] }) {
  if (!rows.length) return null;
  return (
    <>
      <div className="sc-section-label">Partnerships</div>
      <div className="sc-table-wrap">
        <table className="sc-sub-table">
          <thead>
            <tr>
              <th>Pair</th>
              <th className="num">Runs</th>
              <th className="num">Wkts</th>
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.label}>
                <td>
                  {p.batter1} & {p.batter2}
                </td>
                <td className="num">{p.runs}</td>
                <td className="num">{p.wickets}</td>
                <td
                  className={`num ${p.netRuns > 0 ? "sc-net-pos" : p.netRuns < 0 ? "sc-net-neg" : ""}`}
                >
                  {p.netRuns > 0 ? `+${p.netRuns}` : p.netRuns}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FieldingTable({ rows }: { rows: FieldingRow[] }) {
  if (!rows.length) return null;
  return (
    <>
      <div className="sc-section-label">Fielding</div>
      <div className="sc-table-wrap">
        <table className="sc-sub-table">
          <thead>
            <tr>
              <th>Fielder</th>
              <th className="num">Catches</th>
              <th className="num">Run-outs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.fielderName}>
                <td>{f.fielderName}</td>
                <td className="num">{f.catches || "—"}</td>
                <td className="num">{f.runOuts || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function InningsPanel({
  innings,
  variant = "default",
}: {
  innings: InningsScorecardView;
  variant?: "default" | "alt";
}) {
  return (
    <section className="sc-panel">
      <div className={`sc-innings-header ${variant === "alt" ? "alt" : ""}`}>
        <span>{innings.inningsLabel}</span>
        <span className="sc-innings-score">
          {innings.totalRuns}-{innings.wickets} ({innings.overs})
        </span>
      </div>

      <BattingTable batters={innings.batters} />
      <ExtrasTotal innings={innings} />
      <FallOfWickets items={innings.fallOfWickets} />
      <PartnershipsTable rows={innings.partnerships} />

      {innings.bowlers.length > 0 && (
        <>
          <div className="sc-section-label">Bowling</div>
          <BowlingTable bowlers={innings.bowlers} />
        </>
      )}

      <FieldingTable rows={innings.fielding} />
    </section>
  );
}
