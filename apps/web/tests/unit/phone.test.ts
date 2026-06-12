import { describe, expect, it } from "vitest";
import { normalizeUkPhone } from "@/lib/auth/phone";
import { ApiError } from "@/lib/api/http";

describe("normalizeUkPhone", () => {
  it("normalizes common UK formats", () => {
    expect(normalizeUkPhone("07123456789")).toBe("+447123456789");
    expect(normalizeUkPhone("+44 7123 456789")).toBe("+447123456789");
    expect(normalizeUkPhone("447123456789")).toBe("+447123456789");
    expect(normalizeUkPhone("0044 7123 456789")).toBe("+447123456789");
  });

  it("rejects invalid numbers", () => {
    expect(() => normalizeUkPhone("02079460000")).toThrow(ApiError);
    expect(() => normalizeUkPhone("123")).toThrow(ApiError);
  });
});
