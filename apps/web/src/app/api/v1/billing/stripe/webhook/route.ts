import { json } from "@/lib/api/http";
import { handleStripeWebhook } from "@/lib/services/wallet-stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return json({ error: "Missing stripe-signature" }, 400);
    }
    const rawBody = await request.text();
    const result = await handleStripeWebhook(rawBody, signature);
    return json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status: number }).status
        : 500;
    return json({ error: message }, status);
  }
}
