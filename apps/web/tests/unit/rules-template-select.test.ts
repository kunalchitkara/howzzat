import { describe, expect, it } from "vitest";
import {
  isRulesTemplateSuggested,
  RULES_TEMPLATE_SELECT,
} from "@/lib/services/rules-template-select";

describe("rules template select", () => {
  it("omits isSuggested from prisma select", () => {
    expect(RULES_TEMPLATE_SELECT).not.toHaveProperty("isSuggested");
  });

  it("uses isSuggested when present", () => {
    expect(
      isRulesTemplateSuggested({ builtinId: "other", isSuggested: true }),
    ).toBe(true);
  });

  it("falls back to mjca builtin when isSuggested column missing", () => {
    expect(isRulesTemplateSuggested({ builtinId: "mjca-u9-outdoor-v1" })).toBe(
      true,
    );
    expect(isRulesTemplateSuggested({ builtinId: "demo-u9" })).toBe(false);
  });
});
