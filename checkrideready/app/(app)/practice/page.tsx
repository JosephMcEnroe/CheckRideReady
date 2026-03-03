import Link from "next/link";

export default function PracticePage() {
  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: 16 }}>
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
          padding: 18,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>Practice</div>
        <p style={{ marginTop: 8, opacity: 0.85 }}>
          Practice mode can host focused drills by ACS area.
        </p>
        <Link
          href="/sessions/new"
          className="crr-focusable"
          style={{
            display: "inline-flex",
            marginTop: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(0,0,0,0.2)",
            color: "#eaf1ff",
            padding: "10px 14px",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          Start Practice Session
        </Link>
      </div>
    </div>
  );
}
