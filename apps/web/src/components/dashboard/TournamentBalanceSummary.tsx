import { formatPence } from "@howzzat/shared";
import { BtnLink, card } from "./ui";

export function TournamentBalanceSummary({
  orgId,
  tournamentId,
  balancePence,
}: {
  orgId: string;
  tournamentId: string;
  balancePence: number;
}) {
  const walletHref = `/dashboard/organizations/${orgId}/tournaments/${tournamentId}/wallet`;

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Tournament wallet
      </h2>
      <div style={card}>
        <p
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--dk)",
          }}
        >
          {formatPence(balancePence)}
        </p>
        <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
          Charged per player when a match is finalized. Top up before your balance runs out.
        </p>
        <p style={{ marginTop: 12 }}>
          <BtnLink href={walletHref}>Manage wallet</BtnLink>
        </p>
      </div>
    </section>
  );
}
