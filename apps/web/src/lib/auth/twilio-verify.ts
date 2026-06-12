import Twilio from "twilio";
import { ApiError } from "@/lib/api/http";

/** Local dev escape hatch when Twilio trial stores the wrong E.164 format. */
function devSmsBypass(phoneE164: string, code?: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const bypassPhone = process.env.DEV_SMS_BYPASS_PHONE?.trim();
  const bypassCode = process.env.DEV_SMS_BYPASS_CODE?.trim();
  if (!bypassPhone || !bypassCode) return false;
  if (phoneE164 !== bypassPhone) return false;
  return code === undefined || code === bypassCode;
}

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !serviceSid) {
    throw new ApiError(
      503,
      "SMS sign-in is not configured (missing Twilio account or Verify service)",
      "SMS_NOT_CONFIGURED",
    );
  }
  if (!authToken) {
    throw new ApiError(
      503,
      "Add TWILIO_AUTH_TOKEN to apps/web/.env.local, then restart the dev server",
      "SMS_MISSING_AUTH_TOKEN",
    );
  }
  return { accountSid, authToken, serviceSid };
}

function twilioClient() {
  const { accountSid, authToken } = twilioConfig();
  return Twilio(accountSid, authToken);
}

export async function sendSmsVerification(phoneE164: string): Promise<void> {
  if (devSmsBypass(phoneE164)) return;

  const { serviceSid } = twilioConfig();
  const client = twilioClient();

  try {
    await client.verify.v2.services(serviceSid).verifications.create({
      to: phoneE164,
      channel: "sms",
    });
  } catch (err) {
    const twilioErr = err as { code?: number; message?: string };
    const message = twilioErr.message ?? "Could not send verification code";

    if (twilioErr.code === 21608) {
      throw new ApiError(
        403,
        `Trial account: Twilio must verify exactly ${phoneE164}. ` +
          "Remove the old entry, re-add with country +44 and number 7977036943 (no leading 0). " +
          "Or add billing to your Twilio account. For local dev, set DEV_SMS_BYPASS_PHONE and DEV_SMS_BYPASS_CODE in .env.local.",
        "SMS_TRIAL_UNVERIFIED",
      );
    }
    if (message.toLowerCase().includes("blocked")) {
      throw new ApiError(
        403,
        "SMS to this country is not enabled. Twilio Console → Messaging → Settings → Geo permissions → enable United Kingdom.",
        "SMS_GEO_BLOCKED",
      );
    }
    if (process.env.NODE_ENV === "development") {
      throw new ApiError(502, message, "SMS_SEND_FAILED", { code: twilioErr.code });
    }
    throw new ApiError(502, "Could not send verification code", "SMS_SEND_FAILED");
  }
}

export async function checkSmsVerification(
  phoneE164: string,
  code: string,
): Promise<void> {
  if (devSmsBypass(phoneE164, code)) return;

  const { serviceSid } = twilioConfig();
  const client = twilioClient();

  let status: string;
  try {
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: phoneE164, code });
    status = check.status;
  } catch {
    throw new ApiError(400, "Invalid or expired code", "SMS_CODE_INVALID");
  }

  if (status !== "approved") {
    throw new ApiError(400, "Invalid or expired code", "SMS_CODE_INVALID");
  }
}
