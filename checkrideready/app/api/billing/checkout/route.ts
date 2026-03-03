import { auth } from "@/auth";
import { getAppBaseUrl, getOrCreateStripeCustomer, getStripe } from "@/lib/stripe";

type CheckoutRequest = {
  priceId?: string;
};

export async function POST(request: Request) {
  const authSession = await auth();
  const user = authSession?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  const userId = user?.id;
  const email = user?.email || "";

  if (!userId || !email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CheckoutRequest = {};
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    body = {};
  }

  const defaultPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const priceId = body.priceId || defaultPriceId;
  if (!priceId) {
    return Response.json({ error: "Missing Stripe price configuration" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const customerId = await getOrCreateStripeCustomer({ userId, email, name: user?.name });
    const baseUrl = getAppBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${baseUrl}/billing?checkout=success`,
      cancel_url: `${baseUrl}/billing?checkout=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout";
    return Response.json({ error: message }, { status: 500 });
  }
}
