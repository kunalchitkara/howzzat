import { describe, expect, it } from "vitest";
import { ApiError, handleApiError } from "@/lib/api/http";

describe("ApiError and handleApiError", () => {
  it("maps ApiError to JSON response", async () => {
    const res = handleApiError(new ApiError(409, "Duplicate", "SLUG_EXISTS"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SLUG_EXISTS");
  });
});
