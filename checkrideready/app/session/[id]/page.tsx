"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { readJsonResponse } from "@/lib/http";

type Question = {
  id: string;
  stem: string;
  acs_task_code: string;
  acs_area: string;
};

type NextMeta = {
  kind?: "base" | "probe";
  probeCount?: number;
  maxProbes?: number;
  baseQuestionId?: string;
};

type PromptEntry = {
  id: string;
  stem: string;
  kind: "base" | "probe";
};

type SubmitResponse = {
  attemptId: string;
  result: "PASS" | "PROBE" | "REMEDIATE" | "FAIL";
  feedback: string;
  confidence: number;
  missing_points: string[];
  probe_question: string;
  recommended_delta: number;
  acs_task_code: string;
};

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [promptThread, setPromptThread] = useState<PromptEntry[]>([]);

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // This is the latest evaluation returned by the server.
  // We'll keep it visible as "DPE Notes", even while probing.
  const [lastEval, setLastEval] = useState<SubmitResponse | null>(null);

  // If true, we are auto-advancing to a probe prompt
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  async function fetchNextQuestion(opts?: { forceNewBase?: boolean }) {
    if (!sessionId) return;

    setLoadingQuestion(true);
    setQuestionError(null);

    try {
      const res = await fetch("/api/sessions/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, forceNewBase: opts?.forceNewBase === true }),
      });

      const data = await readJsonResponse<{
        question?: Question;
        meta?: NextMeta;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data?.error || "Failed to fetch next prompt");
      if (!data.question) throw new Error("No question returned from server");
      const nextQuestion = data.question;
      const nextKind = data.meta?.kind === "probe" ? "probe" : "base";

      setQuestion(nextQuestion);
      setPromptThread((prev) => {
        const entry: PromptEntry = {
          id: nextQuestion.id,
          stem: nextQuestion.stem,
          kind: nextKind,
        };

        if (nextKind === "base") {
          return [entry];
        }

        if (prev.some((p) => p.id === entry.id)) {
          return prev;
        }

        return [...prev, entry];
      });
      if (nextKind === "base") {
        setLastEval(null);
      }
      setAnswer("");
      setSubmitError(null);
    } catch (e: any) {
      setQuestionError(e.message || "Unknown error");
    } finally {
      setLoadingQuestion(false);
      setAutoAdvancing(false);
    }
  }

  async function handleSubmit() {
    if (!sessionId || !question) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (answer.trim().length < 10) {
        throw new Error("Write at least a couple sentences before submitting.");
      }

      const res = await fetch("/api/answer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: question.id,
          answer: answer.trim(),
        }),
      });

      const data = await readJsonResponse<SubmitResponse & { error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || "Submit failed");

      const evalData = data as SubmitResponse;
      setLastEval(evalData);

  // ✅ Auto-probe behavior:
  // For any non-PASS result, immediately fetch the next prompt.
      // /api/sessions/next will return a "(Probe)" question due to session state.
      if (evalData.result !== "PASS") {
        setAutoAdvancing(true);
        // small delay so the user sees the PROBE badge flash
        setTimeout(() => {
          fetchNextQuestion();
        }, 250);
      }
    } catch (e: any) {
      setSubmitError(e.message || "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (sessionId) fetchNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function badge(result: SubmitResponse["result"]) {
    const base = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      fontWeight: 800 as const,
      letterSpacing: 0.3,
      border: "1px solid transparent",
    };

    if (result === "PASS")
      return { ...base, background: "#0b2", borderColor: "#0b2", color: "#061" };
    if (result === "PROBE")
      return { ...base, background: "#ffb020", borderColor: "#ffb020", color: "#5a3a00" };
    if (result === "REMEDIATE")
      return { ...base, background: "#ff4d4d", borderColor: "#ff4d4d", color: "#5a0000" };
    return { ...base, background: "#ff4d4d", borderColor: "#ff4d4d", color: "#5a0000" };
  }

  const styles = {
    page: { maxWidth: 960, margin: "40px auto", padding: 16, color: "#eaeaea" },
    topTitle: { fontSize: 28, fontWeight: 800, margin: 0 },
    subtle: { opacity: 0.8, marginTop: 6 },
    shell: {
      marginTop: 22,
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      overflow: "hidden",
    },
    headerBar: {
      padding: "14px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap" as const,
    },
    chip: {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(0,0,0,0.25)",
      fontWeight: 700,
      fontSize: 13,
      color: "#f3f3f3",
    },
    body: { padding: 16 },
    h2: { margin: "6px 0 10px 0", fontSize: 18, fontWeight: 800 },
    threadWrap: { marginBottom: 14 },
    threadItem: {
      padding: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.20)",
      marginBottom: 8,
    },
    threadLabel: { fontSize: 12, opacity: 0.78, fontWeight: 800, marginBottom: 6 },
    threadText: { fontSize: 15, lineHeight: 1.5 },
    prompt: {
      fontSize: 18,
      lineHeight: 1.65,
      padding: 14,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.28)",
    },
    label: { marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: 800, opacity: 0.95 },
    textarea: {
      width: "100%",
      padding: 14,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(0,0,0,0.35)",
      color: "#f3f3f3",
      fontSize: 15,
      lineHeight: 1.6,
      outline: "none",
      resize: "vertical" as const,
    },
    error: { color: "#ff7b7b", marginTop: 10, fontWeight: 700 },
    actions: { marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" as const },
    btn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.22)",
      background: "rgba(0,0,0,0.25)",
      color: "#f3f3f3",
      cursor: "pointer",
      fontWeight: 800,
    },
    btnPrimary: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.22)",
      background: "#ffffff",
      color: "#111",
      cursor: "pointer",
      fontWeight: 900,
    },
    link: { alignSelf: "center", opacity: 0.85, textDecoration: "underline", color: "#eaeaea" },
    evalCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.30)",
    },
    evalTop: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const },
    evalText: { marginTop: 10, fontSize: 16, lineHeight: 1.6, color: "#f1f1f1" },
    hint: { marginTop: 10, opacity: 0.8, fontSize: 13, lineHeight: 1.5 },
  } as const;

  // Show the evaluation panel as "DPE Notes" during probing
  const showDpeNotesWhileAnswering =
    lastEval && lastEval.result !== "PASS";

  // Only show the "final eval + Continue" panel for PASS
  const showFinalEvalPanel =
    lastEval && lastEval.result === "PASS";
  const isProbeActive = question?.id.includes("__probe_") ?? false;

  return (
    <main style={styles.page}>
      <h1 style={styles.topTitle}>Oral Session</h1>
      <p style={styles.subtle}>
        Session: <code>{sessionId || "(loading...)"}</code>{" "}
        {sessionId && (
          <>
            {" • "}
            <a href={`/results/${sessionId}`} style={styles.link}>
              View Debrief
            </a>
          </>
        )}
      </p>

      <div style={styles.shell}>
        <div style={styles.headerBar}>
          {question ? (
            <>
              <span style={styles.chip}>{question.acs_task_code}</span>
              <span style={styles.chip}>{question.acs_area}</span>
            </>
          ) : (
            <span style={styles.chip}>Loading…</span>
          )}
        </div>

        <div style={styles.body}>
          {loadingQuestion && <p>{autoAdvancing ? "DPE is probing…" : "Loading next prompt…"} </p>}
          {questionError && <p style={styles.error}>Error: {questionError}</p>}

          {!loadingQuestion && !questionError && question && (
            <>
              {promptThread.length > 0 && (
                <div style={styles.threadWrap}>
                  <div style={styles.h2}>Question Thread</div>
                  {promptThread.map((p, idx) => (
                    <div key={p.id} style={styles.threadItem}>
                      <div style={styles.threadLabel}>
                        {p.kind === "base" ? "Base Question" : `Probe ${idx}`}
                      </div>
                      <div style={styles.threadText}>{p.stem}</div>
                    </div>
                  ))}
                </div>
              )}

              {!isProbeActive && (
                <div>
                  <div style={styles.h2}>Prompt</div>
                  <div style={styles.prompt}>{question.stem}</div>
                </div>
              )}

              {/* DPE Notes (shows during probing) */}
              {showDpeNotesWhileAnswering && (
                <div style={styles.evalCard}>
                  <div style={styles.evalTop}>
                    <span style={badge(lastEval!.result)}>{lastEval!.result}</span>
                    <span style={{ opacity: 0.85, fontWeight: 700 }}>
                      Confidence: {(lastEval!.confidence * 100).toFixed(0)}%
                    </span>
                    <span style={{ opacity: 0.8, fontWeight: 700 }}>DPE Notes</span>
                  </div>
                  <div style={styles.evalText}>{lastEval!.feedback}</div>
                  <div style={styles.hint}>
                    You’re being probed on the same topic. Answer with a clean structure:
                    <b> definition → rule/limit → process → safety/risk → example</b>.
                  </div>
                </div>
              )}

              {/* Final eval panel (only for PASS/REMEDIATE/FAIL) */}
              {showFinalEvalPanel ? (
                <div style={styles.evalCard}>
                  <div style={styles.evalTop}>
                    <span style={badge(lastEval!.result)}>{lastEval!.result}</span>
                    <span style={{ opacity: 0.85, fontWeight: 700 }}>
                      Confidence: {(lastEval!.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div style={styles.evalText}>{lastEval!.feedback}</div>

                  <div style={styles.actions}>
                    <button onClick={fetchNextQuestion} style={styles.btnPrimary}>
                      Continue
                    </button>
                    <a href="/start" style={styles.link}>
                      Back to mode select
                    </a>
                    {sessionId && (
                      <a href={`/results/${sessionId}`} style={styles.link}>
                        View Debrief
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.label}>Your Answer</div>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Answer like you’re speaking to a DPE. Use structure and safety-first reasoning."
                    rows={7}
                    style={styles.textarea}
                  />

                  {submitError && <div style={styles.error}>Error: {submitError}</div>}

                  <div style={styles.actions}>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !answer.trim()}
                      style={{
                        ...styles.btnPrimary,
                        opacity: submitting || !answer.trim() ? 0.7 : 1,
                        cursor: submitting || !answer.trim() ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "Submitting…" : "Submit Answer"}
                    </button>

                    <button
                      onClick={() => fetchNextQuestion({ forceNewBase: true })}
                      disabled={loadingQuestion || !sessionId}
                      style={{
                        ...styles.btn,
                        opacity: loadingQuestion || !sessionId ? 0.7 : 1,
                        cursor: loadingQuestion || !sessionId ? "not-allowed" : "pointer",
                      }}
                    >
                      Skip / New Prompt
                    </button>

                    <a href="/start" style={styles.link}>
                      Back to mode select
                    </a>

                    {sessionId && (
                      <a href={`/results/${sessionId}`} style={styles.link}>
                        View Debrief
                      </a>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

