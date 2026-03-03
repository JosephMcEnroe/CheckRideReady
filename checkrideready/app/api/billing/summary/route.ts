import { auth } from "@/auth";
import { getOrCreateStripeCustomer, getStripe } from "@/lib/stripe";

type BillingSummary = {
  subscription: {
    status: string | null;
    planName: string | null;
    amountCents: number | null;
    currency: string | null;
    interval: string | null;
  };
  paymentMethod: {
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  };
  invoices: Array<{
    id: string;
    date: string;
    amountPaidCents: number;
    currency: string;
    status: string | null;
    number: string | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
};

const subscriptionPriority = new Map([
  ["active", 0],
  ["trialing", 1],
  ["past_due", 2],
  ["unpaid", 3],
  ["canceled", 4],
  ["incomplete", 5],
  ["incomplete_expired", 6],
  ["paused", 7],
]);

function pickPrimarySubscription(subscriptions: { status: string; created: number }[]) {
  return subscriptions
    .slice()
    .sort((a, b) => {
      const rankA = subscriptionPriority.get(a.status) ?? 99;
      const rankB = subscriptionPriority.get(b.status) ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return b.created - a.created;
    })[0];
}

export async function GET() {
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

    const subscriptionsResponse = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.items.data.price.product", "data.default_payment_method"],
      limit: 20,
    });

    const primary = pickPrimarySubscription(subscriptionsResponse.data);
    const firstItem = primary?.items.data[0];
    const product = firstItem?.price.product;
    const planName = typeof product === "object" ? product.name : null;

    const defaultPmFromSubscription =
      primary?.default_payment_method && typeof primary.default_payment_method === "object"
        ? primary.default_payment_method
        : null;

    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    const customerDefaultPm =
      "deleted" in customer
        ? null
        : customer.invoice_settings?.default_payment_method &&
            typeof customer.invoice_settings.default_payment_method === "object"
          ? customer.invoice_settings.default_payment_method
          : null;

    const paymentMethod =
      defaultPmFromSubscription?.type === "card"
        ? defaultPmFromSubscription
        : customerDefaultPm?.type === "card"
          ? customerDefaultPm
          : null;

    const invoicesResponse = await stripe.invoices.list({
      customer: customerId,
      limit: 12,
    });

    const summary: BillingSummary = {
      subscription: {
        status: primary?.status ?? null,
        planName,
        amountCents: firstItem?.price.unit_amount ?? null,
        currency: firstItem?.price.currency ?? null,
        interval: firstItem?.price.recurring?.interval ?? null,
      },
      paymentMethod: {
        brand: paymentMethod?.card?.brand ?? null,
        last4: paymentMethod?.card?.last4 ?? null,
        expMonth: paymentMethod?.card?.exp_month ?? null,
        expYear: paymentMethod?.card?.exp_year ?? null,
      },
      invoices: invoicesResponse.data.map((invoice) => ({
        id: invoice.id,
        date: new Date(invoice.created * 1000).toISOString(),
        amountPaidCents: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        number: invoice.number,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      })),
    };

    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load billing summary";
    return Response.json({ error: message }, { status: 500 });
  }
}
