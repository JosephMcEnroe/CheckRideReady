import { auth } from "@/auth";
import { getAppBaseUrl, getOrCreateStripeCustomer, getStripe } from "@/lib/stripe";

export async function POST() {
  const authSession = await auth();
  const user = authSession?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  const userId = user?.id;
  const email = user?.email || "";

  if (!userId || !email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripe = getStripe();
    const customerId = await getOrCreateStripeCustomer({ userId, email, name: user?.name });
    const baseUrl = getAppBaseUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/billing`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open billing portal";
    return Response.json({ error: message }, { status: 500 });
  }
}
