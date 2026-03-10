export default function HelpPage() {
  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: 16 }}>
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
          padding: 18,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>Help & About</div>
        <div style={{ opacity: 0.88 }}>
          CheckRideReady simulates oral questioning and provides debrief feedback aligned to pilot training flow.
        </div>
        <div style={{ opacity: 0.8 }}>Need help? Start from Sessions, open a debrief, and export a PDF for your CFI.</div>
      </div>
    </div>
  );
}

