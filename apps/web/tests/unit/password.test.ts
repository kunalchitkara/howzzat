import { describe, expect, it } from "vitest";
import {
  hashOtpCode,
  hashPassword,
  verifyOtpCode,
  verifyPassword,
} from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes and verifies passwords", () => {
    const hash = hashPassword("secure-pass-123");
    expect(hash).toMatch(/^scrypt:/);
    expect(verifyPassword("secure-pass-123", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("hashes and verifies OTP codes", () => {
    const stored = hashOtpCode("123456");
    expect(verifyOtpCode("123456", stored)).toBe(true);
    expect(verifyOtpCode("654321", stored)).toBe(false);
  });
});
