#!/usr/bin/env bash
# Fail if dashboard/app code imports @howzzat/db directly or uses prisma in dashboard pages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web/src"
failed=0

if rg -q 'from "@howzzat/db"' "$WEB/app" "$WEB/components" 2>/dev/null; then
  echo "ERROR: apps/web app/components must not import @howzzat/db directly."
  rg 'from "@howzzat/db"' "$WEB/app" "$WEB/components" || true
  failed=1
fi

if rg -q 'from "@/lib/db"|from "../db"|from "../../db"' "$WEB/app/dashboard" 2>/dev/null; then
  echo "ERROR: dashboard pages must use @/lib/services/* instead of prisma/@/lib/db."
  rg 'from "@/lib/db"|from "../db"|from "../../db"' "$WEB/app/dashboard" || true
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "OK: no forbidden direct database imports in dashboard/app UI code."
