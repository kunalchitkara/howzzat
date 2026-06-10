"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { btn } from "./ui";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={logout} style={{ ...btn, background: "#666" }}>
      Sign out
    </button>
  );
}
