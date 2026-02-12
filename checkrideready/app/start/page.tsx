"use client";

import { useState } from "react";

type Mode = "PPL" | "IR" | "CPL";

export default function StartPage() {
  const [loading, setLoading] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(mode: Mode) {
    setLoading(mode);
    setError(null);

    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to start session");

      window.location.href = `/session/${data.sessionId}`;
    } catch (e: any) {
      setError(e.message || "Unknown error");
      setLoading(null);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Start a Session</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>Choose a certificate mode:</p>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => start("PPL")}
          disabled={loading !== null}
          style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #333", fontWeight: 700 }}
        >
          Private
        </button>

        <button
          onClick={() => start("IR")}
          disabled={loading !== null}
          style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #333", fontWeight: 700 }}
        >
          Instrument
        </button>

        <button
          onClick={() => start("CPL")}
          disabled={loading !== null}
          style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid #333", fontWeight: 700 }}
        >
          Commercial
        </button>
      </div>

      {loading && <p style={{ marginTop: 12 }}>Starting {loading} session...</p>}
    </main>
  );
}
