"use client";

import { Check, CreditCard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readJsonResponse } from "@/lib/http";

type BillingStatus = "paid" | "pending" | "failed";

type BillingHistory = {
  id: string;
  date: string;
  amount: string;
  status: BillingStatus;
  invoice: string;
  invoiceUrl: string | null;
};

type BillingSummaryResponse = {
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

type PlanCardProps = {
  name: string;
  price: string;
  period?: string;
  features: string[];
  isPopular?: boolean;
  currentPlan?: boolean;
  disabled?: boolean;
  cta: string;
  onSelect: () => void;
};

const statusColors: Record<BillingStatus, string> = {
  paid: "bg-pass/10 text-pass",
  pending: "bg-probe/10 text-probe",
  failed: "bg-fail/10 text-fail",
};

function toBillingStatus(value: string | null): BillingStatus {
  const normalized = (value || "").toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "open" || normalized === "draft" || normalized === "uncollectible") return "pending";
  return "failed";
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatInvoiceDate(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PlanCard({
  name,
  price,
  period = "month",
  features,
  isPopular,
  currentPlan,
  disabled,
  cta,
  onSelect,
}: PlanCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border-2 p-6 ${
        isPopular ? "border-accent bg-accent/[0.03]" : "border-border bg-card"
      }`}
    >
      {isPopular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">Most Popular</span>
        </div>
      ) : null}
      <h3 className="mb-1 text-foreground">{name}</h3>
      <div className="mb-5">
        <span className="text-2xl text-foreground">{price}</span>
        <span className="text-sm text-muted-foreground">/{period}</span>
      </div>
      <ul className="mb-5 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-pass" />
            <span className="text-[13px] text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled || currentPlan}
        onClick={onSelect}
        className={`w-full rounded-lg px-4 py-2.5 text-sm transition-colors ${
          currentPlan
            ? "cursor-not-allowed bg-secondary text-secondary-foreground"
            : isPopular
              ? "bg-primary text-primary-foreground hover:bg-[#2d5a8f] disabled:opacity-60"
              : "border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-60"
        }`}
      >
        {currentPlan ? "Current Plan" : cta}
      </button>
    </div>
  );
}

function HistoryTable({ rows }: { rows: BillingHistory[] }) {
  if (!rows.length) {
    return <div className="px-4 py-6 text-sm text-muted-foreground">No billing history yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-secondary/50">
          <tr className="text-left">
            <th className="px-4 py-2.5 text-sm text-muted-foreground">Date</th>
            <th className="px-4 py-2.5 text-sm text-muted-foreground">Amount</th>
            <th className="px-4 py-2.5 text-sm text-muted-foreground">Status</th>
            <th className="px-4 py-2.5 text-sm text-muted-foreground">Invoice</th>
            <th className="px-4 py-2.5 text-sm text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className="border-b border-border">
              <td className="px-4 py-3 text-sm text-foreground">{item.date}</td>
              <td className="px-4 py-3 text-sm text-foreground">{item.amount}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs ${statusColors[item.status]}`}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{item.invoice}</td>
              <td className="px-4 py-3">
                {item.invoiceUrl ? (
                  <a
                    href={item.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-md px-2 py-1 text-sm hover:bg-secondary"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Unavailable</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/billing/summary", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          const payload = await readJsonResponse<{ error?: string }>(res);
          throw new Error(payload.error || "Unable to load billing summary");
        }

        const payload = await readJsonResponse<BillingSummaryResponse>(res);
        setSummary(payload);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load billing summary");
      } finally {
        setIsLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const individualHistory: BillingHistory[] = useMemo(() => {
    if (!summary) return [];

    return summary.invoices.map((invoice) => ({
      id: invoice.id,
      date: formatInvoiceDate(invoice.date),
      amount: formatMoney(invoice.amountPaidCents, invoice.currency || "usd"),
      status: toBillingStatus(invoice.status),
      invoice: invoice.number || invoice.id,
      invoiceUrl: invoice.invoicePdf || invoice.hostedInvoiceUrl || null,
    }));
  }, [summary]);

  const hasPaidPlan = (summary?.subscription.status || "") === "active" || (summary?.subscription.status || "") === "trialing";

  const paymentMethodLabel = summary?.paymentMethod.last4
    ? `${summary.paymentMethod.brand?.toUpperCase() || "Card"} ending in ${summary.paymentMethod.last4}`
    : "No payment method on file.";

  const paymentMethodExpiry =
    summary?.paymentMethod.expMonth && summary?.paymentMethod.expYear
      ? `Expires ${String(summary.paymentMethod.expMonth).padStart(2, "0")}/${String(summary.paymentMethod.expYear).slice(-2)}`
      : null;

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await readJsonResponse<{ url?: string; error?: string }>(res);
      if (!res.ok || !payload.url) {
        throw new Error(payload.error || "Unable to start checkout");
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
      setIsCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setIsPortalLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await readJsonResponse<{ url?: string; error?: string }>(res);

      if (!res.ok || !payload.url) {
        throw new Error(payload.error || "Unable to open billing portal");
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal");
      setIsPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription and billing information.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg text-foreground">Choose Your Plan</h2>
        <div className="grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          <PlanCard
            name="Free"
            price="$0"
            features={["5 sessions per month", "Basic analytics", "Single training track", "Community support"]}
            currentPlan={!hasPaidPlan}
            cta="Current Plan"
            disabled={isLoading || isCheckoutLoading || isPortalLoading}
            onSelect={() => {}}
          />
          <PlanCard
            name="Pro"
            price="$29"
            features={[
              "Unlimited sessions",
              "Advanced analytics",
              "All training tracks",
              "Smart drill mode",
              "Priority support",
              "Export reports",
            ]}
            isPopular
            currentPlan={hasPaidPlan}
            cta={isCheckoutLoading ? "Redirecting..." : "Select Plan"}
            disabled={isLoading || isCheckoutLoading || isPortalLoading}
            onSelect={handleCheckout}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-lg text-foreground">Payment Method</h2>
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground">{isLoading ? "Loading..." : paymentMethodLabel}</p>
              {paymentMethodExpiry ? <p className="text-xs text-muted-foreground">{paymentMethodExpiry}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handlePortal}
            disabled={isLoading || isCheckoutLoading || isPortalLoading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-60"
          >
            {isPortalLoading ? "Opening..." : "Update"}
          </button>
        </div>
        <button
          type="button"
          onClick={handlePortal}
          disabled={isLoading || isCheckoutLoading || isPortalLoading}
          className="text-sm text-destructive hover:underline disabled:opacity-60"
        >
          Cancel Subscription
        </button>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-lg text-foreground">Billing History</h2>
        </div>
        <HistoryTable rows={individualHistory} />
      </section>
    </div>
  );
}