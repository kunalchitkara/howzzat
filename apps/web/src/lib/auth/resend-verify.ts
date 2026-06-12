import { randomInt } from "crypto";
import { Resend } from "resend";
import { ApiError } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/email-user";
import { hashOtpCode, verifyOtpCode } from "@/lib/auth/password";

const OTP_TTL_MINUTES = 10;
const MAX_SENDS_PER_HOUR = 5;

/** Local dev escape hatch when Resend is not configured or for fixed test inboxes. */
function devEmailBypass(email: string, code?: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const bypassEmail = process.env.DEV_EMAIL_BYPASS_EMAIL?.trim();
  const bypassCode = process.env.DEV_EMAIL_BYPASS_CODE?.trim();
  if (!bypassEmail || !bypassCode) return false;
  if (normalizeEmail(email) !== normalizeEmail(bypassEmail)) return false;
  return code === undefined || code === bypassCode;
}

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new ApiError(
      503,
      "Email sign-in is not configured (missing RESEND_API_KEY or EMAIL_FROM)",
      "EMAIL_NOT_CONFIGURED",
    );
  }
  return { apiKey, from };
}

export async function sendEmailVerification(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (devEmailBypass(normalized)) return;

  const { apiKey, from } = resendConfig();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await prisma.emailVerification.count({
    where: { email: normalized, createdAt: { gte: oneHourAgo } },
  });
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    throw new ApiError(
      429,
      "Too many codes sent to this email. Try again in an hour.",
      "EMAIL_RATE_LIMITED",
    );
  }

  const code = String(randomInt(100000, 999999));
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.emailVerification.deleteMany({ where: { email: normalized } });
  await prisma.emailVerification.create({
    data: { email: normalized, codeHash, expiresAt },
  });

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from,
      to: normalized,
      subject: "Your Howzzat sign-in code",
      text:
        `Your Howzzat verification code is ${code}. ` +
        `It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`,
      html:
        `<p>Your <strong>Howzzat</strong> sign-in code is:</p>` +
        `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>` +
        `<p style="color:#666">Expires in ${OTP_TTL_MINUTES} minutes. ` +
        `If you didn't request this, you can ignore this email.</p>`,
    });
    if (error) {
      throw error;
    }
  } catch (err) {
    await prisma.emailVerification.deleteMany({ where: { email: normalized } });
    const message = err instanceof Error ? err.message : "Could not send verification email";
    if (process.env.NODE_ENV === "development") {
      throw new ApiError(502, message, "EMAIL_SEND_FAILED");
    }
    throw new ApiError(502, "Could not send verification email", "EMAIL_SEND_FAILED");
  }
}

export async function checkEmailVerification(email: string, code: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (devEmailBypass(normalized, code)) return;

  const record = await prisma.emailVerification.findFirst({
    where: { email: normalized },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new ApiError(400, "Invalid or expired code", "EMAIL_CODE_INVALID");
  }
  if (!verifyOtpCode(code, record.codeHash)) {
    throw new ApiError(400, "Invalid or expired code", "EMAIL_CODE_INVALID");
  }
  await prisma.emailVerification.delete({ where: { id: record.id } });
}
