#!/usr/bin/env bash
# Create Turso prod DB, push schema, and set Vercel env vars.
#
# Prerequisite (run each on its own line):
#   export PATH="$PATH:$HOME/.turso"
#   turso auth login --config-path "$HOME/.config/turso"
#   turso auth whoami --config-path "$HOME/.config/turso"

set -euo pipefail

DB_NAME="${TURSO_DB_NAME:-howzzat-prod}"
DB_LOCATION="${TURSO_LOCATION:-aws-eu-west-1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA_DB="$(mktemp "/tmp/${DB_NAME}.schema.XXXXXX.db")"
IMPORT_DB="$(mktemp "/tmp/${DB_NAME}.import.XXXXXX.db")"
TURSO_CONFIG="${TURSO_CONFIG:-$HOME/.config/turso}"
TURSO_FLAGS=()
if [[ -d "$TURSO_CONFIG" ]]; then
  TURSO_FLAGS=(--config-path "$TURSO_CONFIG")
fi

turso() {
  command turso "${TURSO_FLAGS[@]}" "$@"
}

cleanup() {
  rm -f "$SCHEMA_DB" "$IMPORT_DB"
}
trap cleanup EXIT

if ! command -v turso >/dev/null 2>&1; then
  echo "turso not found. Run: export PATH=\"\$PATH:\$HOME/.turso\""
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 not found — install Xcode Command Line Tools"
  exit 1
fi

require_turso_login() {
  local whoami
  whoami="$(turso auth whoami 2>&1 || true)"
  if [[ "$whoami" == *"not logged in"* ]]; then
    echo "Not logged in to Turso."
    echo "Run: turso auth login --config-path \"\$HOME/.config/turso\""
    exit 1
  fi
  echo "$whoami"
}

apply_schema_via_shell() {
  local schema_sql
  schema_sql="$(mktemp "/tmp/${DB_NAME}.schema.XXXXXX.sql")"
  pnpm exec prisma migrate diff \
    --from-empty \
    --to-schema-datamodel prisma/schema.prisma \
    --script >"$schema_sql"
  turso db shell "$DB_NAME" <"$schema_sql"
  rm -f "$schema_sql"
}

require_turso_login

echo "Building schema in local SQLite (Prisma requires file: URLs)..."
cd "$ROOT/packages/db"
DATABASE_URL="file:${SCHEMA_DB}" pnpm exec prisma db push --skip-generate

echo "Preparing SQLite file for Turso..."
cp "$SCHEMA_DB" "$IMPORT_DB"
sqlite3 "$IMPORT_DB" "PRAGMA journal_mode=WAL;"

echo "Creating Turso database ${DB_NAME} (${DB_LOCATION})..."
turso db destroy "$DB_NAME" --yes 2>/dev/null || true
sleep 2

if ! turso db create "$DB_NAME" --from-file "$IMPORT_DB" --location "$DB_LOCATION" --wait; then
  echo "from-file create failed — creating empty DB and applying SQL schema..."
  turso db destroy "$DB_NAME" --yes 2>/dev/null || true
  sleep 2
  turso db create "$DB_NAME" --location "$DB_LOCATION" --wait
  apply_schema_via_shell
fi

DATABASE_URL="$(turso db show "$DB_NAME" --url 2>&1)"
if [[ "$DATABASE_URL" == *"not logged in"* ]] || [[ ! "$DATABASE_URL" == libsql://* ]]; then
  echo "Failed to read Turso database URL:"
  echo "$DATABASE_URL"
  exit 1
fi

DATABASE_AUTH_TOKEN="$(turso db tokens create "$DB_NAME" 2>&1)"
if [[ "$DATABASE_AUTH_TOKEN" == *"not logged in"* ]] || [[ "$DATABASE_AUTH_TOKEN" == *"Error"* ]]; then
  echo "Failed to create Turso auth token:"
  echo "$DATABASE_AUTH_TOKEN"
  exit 1
fi

echo "Setting Vercel production env vars..."
cd "$ROOT"
pnpm exec vercel env rm DATABASE_URL production --yes 2>/dev/null || true
pnpm exec vercel env rm DATABASE_AUTH_TOKEN production --yes 2>/dev/null || true
printf '%s' "$DATABASE_URL" | pnpm exec vercel env add DATABASE_URL production --yes --force
printf '%s' "$DATABASE_AUTH_TOKEN" | pnpm exec vercel env add DATABASE_AUTH_TOKEN production --yes --force

echo ""
echo "Done."
echo "  DATABASE_URL=$DATABASE_URL"
echo "  DATABASE_AUTH_TOKEN=<set on Vercel>"
echo ""
echo "Redeploy: cd $ROOT && pnpm exec vercel deploy --prod --yes"
