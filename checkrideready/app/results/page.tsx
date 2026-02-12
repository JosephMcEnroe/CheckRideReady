"use client";

import { useEffect, useState } from "react";

type SessionRow = {
  id: string;
  mode: string;
  status: string;
  created_at: string;

  total: number;
  passCount: number;
  probeCount: number;
  remediateCount: number;
  failCount: number;

  lastAttemptAt: string;
};

export default function ResultsIndexPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch("/api/sessions/list");
        const text = await res.text();
        const json = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(json?.error || "Failed to load sessions");

        setSessions(json.sessions || []);
      } catch (e: any) {
        setErr(e.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const styles = {
    page: { maxWidth: 960, margin: "40px auto", padding: 16, color: "#eaeaea" },
    title: { fontSize: 28, fontWeight: 900, margin: 0 },
    subtle: { opacity: 0.8, marginTop: 6 },
    shell: {
      marginTop: 18,
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      overflow: "hidden",
    },
    body: { padding: 16 },
    error: { color: "#ff7b7b", fontWeight: 800 },
    grid: { display: "grid", gap: 12 },
    card: {
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.28)",
      display: "grid",
      gap: 10,
    },
    row: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const },
    chip: {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.25)",
      fontWeight: 800,
      fontSize: 13,
      color: "#f3f3f3",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    kpis: { display: "flex", gap: 10, flexWrap: "wrap" as const },
    btnPrimary: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.22)",
      background: "#ffffff",
      color: "#111",
      cursor: "pointer",
      fontWeight: 900,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    btn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.22)",
      background: "rgba(0,0,0,0.25)",
      color: "#f3f3f3",
      cursor: "pointer",
      fontWeight: 800,
      textDecoration: "none",
    },
    small: { opacity: 0.85, fontSize: 13, lineHeight: 1.4 },
  } as const;

  const modeName = (m: string) => {
    if (m === "PPL") return "Private (PPL)";
    if (m === "IR") return "Instrument (IR)";
    if (m === "CPL") return "Commercial (CPL)";
    return m;
  };

  const pct = (num: number, den: number) => {
    if (!den) return 0;
    return Math.round((num / den) * 100);
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Results</h1>
      <p style={styles.subtle}>Each session has its own debrief. Click one to review.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <a href="/start" style={styles.btnPrimary}>Start new session</a>
      </div>

      <div style={styles.shell}>
        <div style={styles.body}>
          {loading && <p>Loading sessions…</p>}
          {err && <p style={styles.error}>Error: {err}</p>}

          {!loading && !err && (
            <div style={styles.grid}>
              {sessions.length === 0 ? (
                <div style={styles.card}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>No sessions yet</div>
                  <div style={styles.small}>
                    Start a session, answer a few prompts, then come back here to see the debrief cards.
                  </div>
                  <a href="/start" style={styles.btnPrimary}>Start now</a>
                </div>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} style={styles.card}>
                    <div style={styles.row}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span style={styles.chip}>{modeName(s.mode)}</span>
                        <span style={styles.chip}>Attempts: {s.total}</span>
                        <span style={styles.chip}>Pass rate: {pct(s.passCount, s.total)}%</span>
                      </div>
                      <div style={styles.small}>
                        Last activity: {s.lastAttemptAt ? new Date(s.lastAttemptAt).toLocaleString() : "—"}
                      </div>
                    </div>

                    <div style={styles.kpis}>
                      <span style={styles.chip}>PASS: {s.passCount}</span>
                      <span style={styles.chip}>PROBE: {s.probeCount}</span>
                      <span style={styles.chip}>REMEDIATE: {s.remediateCount}</span>
                      <span style={styles.chip}>FAIL: {s.failCount}</span>
                      <span style={styles.chip}>Status: {s.status}</span>
                    </div>

                    <div style={styles.row}>
                      <a href={`/results/${s.id}`} style={styles.btnPrimary}>
                        View debrief →
                      </a>
                      <a href={`/session/${s.id}`} style={styles.btn}>
                        Resume session
                      </a>
                    </div>

                    <div style={styles.small}>
                      Session ID: <code>{s.id}</code>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
