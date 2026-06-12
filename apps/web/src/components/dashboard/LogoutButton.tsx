"use client";

import { apiFetch } from "@/lib/client/api";
import { btn } from "./ui";

export function LogoutButton() {
  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    // Hard navigation so cleared session cookie and RSC cache stay in sync.
    window.location.assign("/login");
  }

  return (
    <button type="button" onClick={logout} style={{ ...btn, background: "#666" }}>
      Sign out
    </button>
  );
}
