"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WALLET_TOP_UP_AMOUNTS_PENCE, formatPence } from "@howzzat/shared";
import { apiFetch } from "@/lib/client/api";
import { btn, card } from "./ui";

export function TournamentWalletPanel({
  tournamentId,
  orgId,
  balancePence,
}: {
  tournamentId: string;
  orgId: string;
  balancePence: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState(balancePence);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const walletStatus = searchParams.get("wallet");
    const sessionId = searchParams.get("session_id");
    if (walletStatus === "success" && sessionId) {
      void apiFetch<{ balancePence: number }>(
        `/api/v1/tournaments/${tournamentId}/wallet/confirm?session_id=${encodeURIComponent(sessionId)}`,
        { method: "POST" },
      )
        .then((data) => {
          setBalance(data.balancePence);
          setMessage("Wallet topped up successfully.");
          router.replace(
            `/dashboard/organizations/${orgId}/tournaments/${tournamentId}`,
          );
        })
        .catch((e) => {
          setMessage(e instanceof Error ? e.message : "Could not confirm payment");
        });
    } else if (walletStatus === "cancelled") {
      setMessage("Top-up cancelled.");
      router.replace(
        `/dashboard/organizations/${orgId}/tournaments/${tournamentId}`,
      );
    }
  }, [orgId, router, searchParams, tournamentId]);

  async function topUp(amountPence: number) {
    setBusy(amountPence);
    setMessage(null);
    try {
      const { url } = await apiFetch<{ url: string | null }>(
        `/api/v1/tournaments/${tournamentId}/wallet/checkout`,
        {
          method: "POST",
          body: JSON.stringify({ amountPence }),
        },
      );
      if (!url) throw new Error("Stripe did not return a checkout URL");
      window.location.href = url;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Checkout failed");
      setBusy(null);
    }
  }

  const low = balance < 250;

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Tournament wallet
      </h2>
      <div style={card}>
        <p style={{ fontSize: "1.25rem", fontWeight: 700, color: low ? "var(--red)" : "var(--dk)" }}>
          {formatPence(balance)}
        </p>
        <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4, marginBottom: 12 }}>
          Minimum £2.50 required before scoring. Charged per player at match end (20p default).
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {WALLET_TOP_UP_AMOUNTS_PENCE.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={busy !== null}
              onClick={() => void topUp(amount)}
              style={{ ...btn, minWidth: 72 }}
            >
              {busy === amount ? "…" : formatPence(amount)}
            </button>
          ))}
        </div>
        {message && (
          <p style={{ marginTop: 12, color: "var(--md)", fontSize: "0.9rem" }}>{message}</p>
        )}
        <p style={{ marginTop: 12, fontSize: "0.8rem", color: "#888" }}>
          Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC.
        </p>
      </div>
    </section>
  );
}
