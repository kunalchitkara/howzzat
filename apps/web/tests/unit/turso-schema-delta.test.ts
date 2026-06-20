import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(
  import.meta.dirname,
  "../../../../packages/db/prisma/schema.prisma",
);

/** Columns that apply-turso-schema-delta.sh adds to production Turso. */
const EXPECTED_TURSO_DELTA_COLUMNS: Record<string, string[]> = {
  RulesProfileTemplate: ["isSuggested"],
  Delivery: ["clientDeliveryId"],
};

function parsePrismaModels(schema: string): Map<string, Set<string>> {
  const models = new Map<string, Set<string>>();
  const modelBlocks = schema.matchAll(/model\s+(\w+)\s+\{([^}]+)\}/g);

  for (const [, name, body] of modelBlocks) {
    const fields = new Set<string>();
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) {
        continue;
      }
      const field = trimmed.split(/\s+/)[0];
      if (field) fields.add(field);
    }
    models.set(name, fields);
  }

  return models;
}

describe("Turso schema delta coverage", () => {
  it("Prisma schema includes columns managed by apply-turso-schema-delta.sh", () => {
    const schema = readFileSync(SCHEMA_PATH, "utf8");
    const models = parsePrismaModels(schema);

    for (const [model, columns] of Object.entries(EXPECTED_TURSO_DELTA_COLUMNS)) {
      const fields = models.get(model);
      expect(fields, `model ${model} missing from schema.prisma`).toBeDefined();
      for (const column of columns) {
        expect(fields!.has(column), `${model}.${column}`).toBe(true);
      }
    }
  });
});
