#!/usr/bin/env bash
# Apply incremental schema changes to production Turso (safe to re-run).
#
# Prerequisite:
#   export PATH="$PATH:$HOME/.turso"
#   turso auth login --config-path "$HOME/.config/turso"
#
# Usage:
#   ./scripts/apply-turso-schema-delta.sh howzzat-production

set -euo pipefail

DB_NAME="${1:-howzzat-production}"
TURSO_CONFIG="${TURSO_CONFIG:-$HOME/.config/turso}"
TURSO_FLAGS=()
if [[ -d "$TURSO_CONFIG" ]]; then
  TURSO_FLAGS=(--config-path "$TURSO_CONFIG")
fi

turso() {
  command turso "${TURSO_FLAGS[@]}" "$@"
}

column_exists() {
  local table="$1"
  local column="$2"
  turso db shell "$DB_NAME" "PRAGMA table_info(${table});" 2>/dev/null | grep -q "|${column}|"
}

echo "Checking ${DB_NAME} schema deltas..."

if ! column_exists "RulesProfileTemplate" "isSuggested"; then
  echo "Adding RulesProfileTemplate.isSuggested..."
  turso db shell "$DB_NAME" \
    "ALTER TABLE RulesProfileTemplate ADD COLUMN isSuggested BOOLEAN NOT NULL DEFAULT 0;"
  turso db shell "$DB_NAME" \
    "UPDATE RulesProfileTemplate SET isSuggested = 1 WHERE builtinId = 'mjca-u9-outdoor-v1';"
else
  echo "RulesProfileTemplate.isSuggested already present."
fi

if ! column_exists "Delivery" "clientDeliveryId"; then
  echo "Adding Delivery.clientDeliveryId..."
  turso db shell "$DB_NAME" \
    "ALTER TABLE Delivery ADD COLUMN clientDeliveryId TEXT;"
  turso db shell "$DB_NAME" \
    "CREATE UNIQUE INDEX IF NOT EXISTS Delivery_clientDeliveryId_key ON Delivery(clientDeliveryId);"
else
  echo "Delivery.clientDeliveryId already present."
fi

echo "Done."
