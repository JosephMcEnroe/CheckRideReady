  return NextResponse.json({
    status: "billing_not_configured",
    plan: null,
    message: "Stripe billing is not configured yet",
  });
}
