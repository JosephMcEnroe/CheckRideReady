"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { readJsonResponse } from "@/lib/http";

type Result = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

type ApiResponse = {
  session: { id: string; mode: string; status: string; created_at: string };
  counts: {
    total: number;
    passCount: number;
    probeCount: number;
    remediateCount: number;
    failCount: number;
  };
  weakest: Array<{ acs_task_code: string; mastery: number; attempts: number; passes: number; fails: number; acs_area: string | null }>;
  strongest: Array<{ acs_task_code: string; mastery: number; attempts: number; passes: number; fails: number; acs_area: string | null }>;
  mostProbed: Array<{ acs_task_code: string; probes: number; acs_area: string | null }>;
  attempts: Array<{
    id: string;
    created_at: string;
    result: Result;
    acs_task_code: string;
    question_id: string;
    acs_area: string | null;
    stem: string | null;
  }>;
};

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/sessions/results?sessionId=${encodeURIComponent(sessionId)}`);
        const json = await readJsonResponse<ApiResponse & { error?: string }>(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load results");

        setData(json);
      } catch (e: any) {
        setErr(e.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const styles = {
    page: { maxWidth: 960, margin: "40px auto", padding: 16, color: "#eaeaea" },
    title: { fontSize: 28, fontWeight: 900, margin: 0 },
    subtle: { opacity: 0.8, marginTop: 6 },
    shell: {
      marginTop: 22,
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      overflow: "hidden",
    },
    body: { padding: 16 },
    sectionTitle: { margin: "18px 0 10px 0", fontSize: 16, fontWeight: 900, opacity: 0.95 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    card: {
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.30)",
    },
    row: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" as const },
    chip: {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.25)",
      fontWeight: 800,
      fontSize: 13,
      color: "#f3f3f3",
      display: "inline-flex",
      gap: 8,
      alignItems: "center",
    },
    list: { marginTop: 8, display: "grid", gap: 8 },
    item: {
      padding: 12,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.22)",
    },
    small: { fontSize: 13, opacity: 0.85, lineHeight: 1.4 },
    link: { opacity: 0.9, textDecoration: "underline", color: "#eaeaea" },
    error: { color: "#ff7b7b", fontWeight: 800 },
  } as const;

  const badge = (r: Result) => {
    const base = {
      padding: "4px 10px",
      borderRadius: 999,
      fontWeight: 900 as const,
      letterSpacing: 0.2,
      border: "1px solid transparent",
    };
    if (r === "PASS") return { ...base, background: "#0b2", borderColor: "#0b2", color: "#061" };
    if (r === "PROBE") return { ...base, background: "#ffb020", borderColor: "#ffb020", color: "#5a3a00" };
    return { ...base, background: "#ff4d4d", borderColor: "#ff4d4d", color: "#5a0000" };
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Session Debrief</h1>
      <p style={styles.subtle}>
        Session: <code>{sessionId}</code>
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <a style={styles.link} href="/start">Start a new session</a>
        {sessionId && <a style={styles.link} href={`/session/${sessionId}`}>Back to this session</a>}
      </div>

      <div style={styles.shell}>
        <div style={styles.body}>
          {loading && <p>Loading results…</p>}
          {err && <p style={styles.error}>Error: {err}</p>}

          {!loading && !err && data && (
            <>
              <div style={styles.grid2}>
                <div style={styles.card}>
                  <div style={styles.row}>
                    <span style={styles.chip}>Mode</span>
                    <span style={{ fontWeight: 900 }}>{data.session.mode}</span>
                  </div>
                  <div style={{ height: 10 }} />
                  <div style={styles.row}>
                    <span style={styles.chip}>Attempts</span>
                    <span style={{ fontWeight: 900 }}>{data.counts.total}</span>
                  </div>
                  <div style={{ height: 10 }} />
                  <div style={styles.row}>
                    <span style={styles.chip}>PASS</span>
                    <span style={{ fontWeight: 900 }}>{data.counts.passCount}</span>
                  </div>
                  <div style={{ height: 10 }} />
                  <div style={styles.row}>
                    <span style={styles.chip}>PROBE</span>
                    <span style={{ fontWeight: 900 }}>{data.counts.probeCount}</span>
                  </div>
                  <div style={{ height: 10 }} />
                  <div style={styles.row}>
                    <span style={styles.chip}>REMEDIATE</span>
                    <span style={{ fontWeight: 900 }}>{data.counts.remediateCount}</span>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>What to do next</div>
                  <div style={{ marginTop: 10 }} className="small" />
                  <div style={styles.small}>
                    Focus on the <b>weakest ACS tasks</b> first. If you see repeated PROBEs on the same task,
                    you’re not giving a structured, safety-first answer.
                  </div>
                  <div style={{ marginTop: 10 }} />
                  <div style={styles.small}>
                    Goal for next session: reduce PROBEs by answering with:
                    <b> definition → rule/limit → process → safety/risk → example</b>.
                  </div>
                </div>
              </div>

              <div style={styles.sectionTitle}>Weakest ACS tasks</div>
              <div style={styles.list}>
                {data.weakest.map((x) => (
                  <div key={x.acs_task_code} style={styles.item}>
                    <div style={styles.row}>
                      <span style={styles.chip}>{x.acs_task_code}</span>
                      <span style={{ fontWeight: 900 }}>Mastery: {Number(x.mastery).toFixed(1)}/5</span>
                    </div>
                    <div style={styles.small}>
                      {x.acs_area || "—"} • Attempts {x.attempts} • Passes {x.passes} • Fails {x.fails}
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.sectionTitle}>Most probed this session</div>
              <div style={styles.list}>
                {data.mostProbed.length === 0 ? (
                  <div style={styles.item}>
                    <div style={styles.small}>No probes logged yet for this session.</div>
                  </div>
                ) : (
                  data.mostProbed.map((x) => (
                    <div key={x.acs_task_code} style={styles.item}>
                      <div style={styles.row}>
                        <span style={styles.chip}>{x.acs_task_code}</span>
                        <span style={{ fontWeight: 900 }}>{x.probes} probes</span>
                      </div>
                      <div style={styles.small}>{x.acs_area || "—"}</div>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.sectionTitle}>Attempt history (latest 30)</div>
              <div style={styles.list}>
                {data.attempts.map((a) => (
                  <div key={a.id} style={styles.item}>
                    <div style={styles.row}>
                      <span style={badge(a.result)}>{a.result}</span>
                      <span style={styles.chip}>{a.acs_task_code}</span>
                    </div>
                    <div style={{ marginTop: 8, ...styles.small }}>
                      {a.acs_area || "—"}
                    </div>
                    {a.stem && (
                      <div style={{ marginTop: 8, ...styles.small }}>
                        <b>Prompt:</b> {a.stem.length > 140 ? a.stem.slice(0, 140) + "…" : a.stem}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={styles.sectionTitle}>Strongest ACS tasks</div>
              <div style={styles.list}>
                {data.strongest.map((x) => (
                  <div key={x.acs_task_code} style={styles.item}>
                    <div style={styles.row}>
                      <span style={styles.chip}>{x.acs_task_code}</span>
                      <span style={{ fontWeight: 900 }}>Mastery: {Number(x.mastery).toFixed(1)}/5</span>
                    </div>
                    <div style={styles.small}>
                      {x.acs_area || "—"} • Attempts {x.attempts} • Passes {x.passes} • Fails {x.fails}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
