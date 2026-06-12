import { describe, expect, it } from "vitest";
import { WALLET_TOP_UP_AMOUNTS_PENCE } from "@howzzat/shared";

describe("wallet top-up amounts", () => {
  it("offers £10, £20, £50", () => {
    expect(WALLET_TOP_UP_AMOUNTS_PENCE).toEqual([1000, 2000, 5000]);
  });
});
