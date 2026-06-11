import { describe, expect, it } from "vitest";
import { parseApiErrorMessage } from "@/lib/client/api";

describe("parseApiErrorMessage", () => {
  it("reads string error field from API JSON", () => {
    expect(
      parseApiErrorMessage({
        error: "Each side needs at least 2 players in the match squad",
        code: "SQUAD_INCOMPLETE",
      }),
    ).toBe("Each side needs at least 2 players in the match squad");
  });

  it("reads nested error.message", () => {
    expect(parseApiErrorMessage({ error: { message: "Validation failed" } })).toBe(
      "Validation failed",
    );
  });

  it("appends zod field errors for validation failures", () => {
    expect(
      parseApiErrorMessage({
        error: "Validation failed",
        details: { fieldErrors: { bowlerId: ["Invalid cuid"] } },
      }),
    ).toBe("Validation failed — bowlerId: Invalid cuid");
  });
});
