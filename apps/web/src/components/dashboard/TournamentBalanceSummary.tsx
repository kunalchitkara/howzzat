import Link from "next/link";
import { formatPence } from "@howzzat/shared";
import { card } from "./ui";

export function TournamentBalanceSummary({
  orgId,
  tournamentId,
  balancePence,
}: {
  orgId: string;
  tournamentId: string;
  balancePence: number;
}) {
  const low = balancePence < 250;
  const walletHref = `/dashboard/organizations/${orgId}/tournaments/${tournamentId}/wallet`;

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Tournament wallet
      </h2>
      <Link href={walletHref} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ ...card, cursor: "pointer" }}>
          <p
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: low ? "var(--red)" : "var(--dk)",
            }}
          >
            {formatPence(balancePence)}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
            {low
              ? "Balance below £2.50 — top up or redeem a coupon before scoring."
              : "Minimum £2.50 required before scoring."}
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--md)", marginTop: 8, fontWeight: 600 }}>
            Manage wallet →
          </p>
        </div>
      </Link>
    </section>
  );
}
