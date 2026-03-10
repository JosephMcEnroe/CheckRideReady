// TODO: Implement Stripe billing integration
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "billing_not_configured",
    plan: null,
    message: "Stripe billing is not configured yet",
  });
}
