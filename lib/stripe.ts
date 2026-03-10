import Stripe from "stripe";
import { pool } from "@/lib/db";

type MySqlError = Error & { code?: string };

let cachedStripe: Stripe | null = null;

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing env var: STRIPE_SECRET_KEY");
  }
  return key;
}

export function getStripe(): Stripe {
  if (!cachedStripe) {
    cachedStripe = new Stripe(getStripeSecretKey(), {
      apiVersion: "2026-02-25.clover",
    });
  }
  return cachedStripe;
}

export function getAppBaseUrl(): string {
  const url = process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function getSavedCustomerId(userId: string): Promise<string | null> {
  try {
    const [rows] = await pool.execute(
      "SELECT stripe_customer_id FROM billing_customers WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const first = (rows as Array<{ stripe_customer_id?: string }>)[0];
    return first?.stripe_customer_id || null;
  } catch (error) {
    const mysqlError = error as MySqlError;
    if (mysqlError.code === "ER_NO_SUCH_TABLE") {
      return null;
    }
    throw error;
  }
}

async function saveCustomerId(userId: string, customerId: string): Promise<void> {
  try {
    await pool.execute(
      `
      INSERT INTO billing_customers (user_id, stripe_customer_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE stripe_customer_id = VALUES(stripe_customer_id)
      `,
      [userId, customerId]
    );
  } catch (error) {
    const mysqlError = error as MySqlError;
    if (mysqlError.code === "ER_NO_SUCH_TABLE") {
      return;
    }
    throw error;
  }
}

export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<string> {
  const { userId, email, name } = input;
  const stripe = getStripe();

  const savedCustomerId = await getSavedCustomerId(userId);
  if (savedCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(savedCustomerId);
      if (!("deleted" in customer && customer.deleted)) {
        return savedCustomerId;
      }
    } catch {
      // Fall through to create a fresh customer.
    }
  }

  const existingByEmail = await stripe.customers.list({ email, limit: 1 });
  const existingCustomer = existingByEmail.data[0];
  if (existingCustomer?.id) {
    await saveCustomerId(userId, existingCustomer.id);
    return existingCustomer.id;
  }

  const created = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { app_user_id: userId },
  });

  await saveCustomerId(userId, created.id);
  return created.id;
}
