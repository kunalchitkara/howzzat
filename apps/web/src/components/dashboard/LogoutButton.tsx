"use client";

import { apiFetch } from "@/lib/client/api";
import { btnClass } from "./ui";

export function LogoutButton() {
  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    // Hard navigation so cleared session cookie and RSC cache stay in sync.
    window.location.assign("/login");
  }

  return (
    <button type="button" onClick={logout} className={`${btnClass} btn-nav`} style={{ background: "#64748b" }}>
      Sign out
    </button>
  );
}
