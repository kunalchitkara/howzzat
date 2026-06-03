import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "@howzzat/db";
import { slugify, uniqueSlug } from "@/lib/api/slug";
import { createOrganizationSchema } from "@/lib/validations";

describe("slug helpers", () => {
  it("slugifies names", () => {
    expect(slugify("Edgware Cricket Club")).toBe("edgware-cricket-club");
    expect(slugify("  U9  Softball!!!  ")).toBe("u9-softball");
  });

  it("uniqueSlug appends suffix", () => {
    expect(uniqueSlug("Edgware", "abc12345")).toBe("edgware-abc12345");
  });
});

describe("Zod validations", () => {
  it("validates organization create", () => {
    const parsed = createOrganizationSchema.parse({
      name: "Test Club",
      slug: "test-club",
    });
    expect(parsed.name).toBe("Test Club");
  });

  it("rejects short organization name", () => {
    expect(() => createOrganizationSchema.parse({ name: "A" })).toThrow();
  });
});

describe("database connectivity", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("connects to test sqlite database", async () => {
    const count = await prisma.organization.count();
    expect(count).toBe(0);
  });
});
