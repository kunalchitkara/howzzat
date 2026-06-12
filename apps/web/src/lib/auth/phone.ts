import { ApiError } from "@/lib/api/http";

/** Normalize UK mobile numbers to E.164 (+44…). */
export function normalizeUkPhone(input: string): string {
  const raw = input.replace(/[\s\-().]/g, "");
  if (!raw) {
    throw new ApiError(400, "Enter a mobile number", "INVALID_PHONE");
  }

  let digits = raw;
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("44")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (!/^7\d{9}$/.test(digits)) {
    throw new ApiError(
      400,
      "Enter a valid UK mobile number (e.g. 07xxx xxxxxx)",
      "INVALID_PHONE",
    );
  }

  return `+44${digits}`;
}
