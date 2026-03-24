"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Download, FileText, Send } from "lucide-react";
import { StatusBadge } from "@/components/figma/StatusBadge";
import { VoiceInput } from "@/components/figma/VoiceInput";
import { readJsonResponse } from "@/lib/http";

type ResultCode = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

type ResultQuestion = {
  id: number;
  question_id: string | null;
  acs_task: string | null;
  acs_area: string | null;
  question_text: string;
  user_answer: string | null;
  ai_feedback: string | null;
  result: ResultCode | null;
  is_probe: boolean;
  created_at: string;
};

type SessionResultsResponse = {
  session: {
    id: string;
    status: "active" | "completed";
    current_question_id: string | null;
  };
  questions: ResultQuestion[];
};

type NextQuestionResponse =
  | {
      type: "QUESTION";
      question: {
        id: string;
        session_question_id: number;
        stem: string;
        acs_task_code: string | null;
        acs_area: string | null;
      };
      meta?: {
        kind?: "base" | "probe";
        is_scenario?: boolean;
      };
    }
  | {
      type: "SESSION_COMPLETE";
      sessionId: string;
      redirectTo?: string;
    };

type SubmitAnswerResponse = {
  result: ResultCode;
  feedback: string;
  probe_question: string | null;
  continue_thread?: boolean;
  thread_status?: "continue" | "mastery" | "failed_after_escalation";
};

type SubmissionState = {
  result: ResultCode;
  feedback: string;
};

type PromptState = {
  questionId: string;
  sessionQuestionId: number;
  stem: string;
  acsTask: string | null;
  acsArea: string | null;
  kind: "base" | "probe";
  isScenario?: boolean;
};

function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function humanResult(r: ResultCode | null) {
  return r || "IN_PROGRESS";
}

function displayQuestionText(text: string) {
  return text.replace(/^Examiner Follow-Up:\s*/i, "").trim();
}

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"active" | "completed">("active");
  const [questions, setQuestions] = useState<ResultQuestion[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<PromptState | null>(null);
  const [answer, setAnswer] = useState("");
  const [lastSubmission, setLastSubmission] = useState<SubmissionState | null>(null);
  const isAwaitingNext = lastSubmission !== null;

  const answered = useMemo(() => questions.filter((q) => q.result !== null), [questions]);

  const pendingPromptFromHistory = useMemo(() => {
    const pending = questions.find((q) => q.result === null);
    if (!pending) return null;
    return {
      questionId: pending.question_id || String(pending.id),
      sessionQuestionId: pending.id,
      stem: displayQuestionText(pending.question_text),
      acsTask: pending.acs_task,
      acsArea: pending.acs_area,
      kind: pending.is_probe ? ("probe" as const) : ("base" as const),
    };
  }, [questions]);

  const activePrompt = currentPrompt || pendingPromptFromHistory;

  const activeBaseQuestionId = useMemo(() => {
    if (!activePrompt) return null;
    if (activePrompt.questionId.includes("__probe_")) {
      return activePrompt.questionId.split("__probe_")[0];
    }
    return activePrompt.kind === "base" ? activePrompt.questionId : null;
  }, [activePrompt]);

  const activeThreadStartIndex = useMemo(() => {
    if (!activePrompt) return -1;

    if (activeBaseQuestionId) {
      for (let i = questions.length - 1; i >= 0; i -= 1) {
        const q = questions[i];
        if (!q.is_probe && q.question_id === activeBaseQuestionId) return i;
      }
    }

    if (activePrompt.acsTask) {
      for (let i = questions.length - 1; i >= 0; i -= 1) {
        const q = questions[i];
        if (!q.is_probe && q.acs_task === activePrompt.acsTask) return i;
      }
    }

    const idxBySessionQuestion = questions.findIndex((q) => q.id === activePrompt.sessionQuestionId);
    return idxBySessionQuestion >= 0 ? idxBySessionQuestion : -1;
  }, [activePrompt, activeBaseQuestionId, questions]);

  const threadAnswered = useMemo(() => {
    if (activeThreadStartIndex < 0) return [];
    return questions.slice(activeThreadStartIndex).filter((q) => q.result !== null);
  }, [activeThreadStartIndex, questions]);

  const activeThreadQuestions = useMemo(() => {
    if (activeThreadStartIndex < 0) return [];
    return questions.slice(activeThreadStartIndex);
  }, [activeThreadStartIndex, questions]);

  const baseQuestionForPrompt = useMemo(() => {
    const active = currentPrompt || pendingPromptFromHistory;
    if (!active) return null;
    if (active.kind === "base") return active.stem;

    const lastBase = [...answered].reverse().find((q) => q.acs_task && q.acs_task === active.acsTask && !q.is_probe);
    return lastBase?.question_text || "Continuing prior base question";
  }, [currentPrompt, pendingPromptFromHistory, answered]);

  async function loadResults() {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/results?sessionId=${encodeURIComponent(sessionId)}`, {
      cache: "no-store",
    });
    const json = await readJsonResponse<SessionResultsResponse & { error?: string }>(res);
    if (!res.ok) throw new Error(json.error || "Failed to load session");

    setQuestions(json.questions);
    setSessionStatus(json.session.status);

    return json;
  }

  async function requestNextQuestion(forceNewBase = false) {
    if (!sessionId) return;
    const res = await fetch("/api/sessions/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, forceNewBase }),
    });
    const json = await readJsonResponse<NextQuestionResponse & { error?: string }>(res);
    if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to get next question");

    if (json.type === "SESSION_COMPLETE") {
      setCurrentPrompt(null);
      setSessionStatus("completed");
      window.location.href = json.redirectTo || `/sessions/${sessionId}/debrief`;
      return;
    }

    const nextPrompt = {
      questionId: json.question.id,
      sessionQuestionId: json.question.session_question_id,
      stem: json.question.stem,
      acsTask: json.question.acs_task_code,
      acsArea: json.question.acs_area,
      kind: json.meta?.kind === "probe" ? "probe" : "base",
      isScenario: json.meta?.is_scenario === true,
    } satisfies PromptState;

    setCurrentPrompt(nextPrompt);
    setLastSubmission(null);
    return nextPrompt;
  }

  useEffect(() => {
    if (!sessionId) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadResults();
        if (!mounted) return;
        if (pendingPromptFromHistory) {
          setCurrentPrompt(pendingPromptFromHistory);
        }
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (pendingPromptFromHistory) {
      setCurrentPrompt(pendingPromptFromHistory);
    }
  }, [pendingPromptFromHistory]);

  useEffect(() => {
    if (loading || sessionStatus !== "active") return;
    if (pendingPromptFromHistory) return;
    if (currentPrompt) return;

    let cancelled = false;
    (async () => {
      try {
        await requestNextQuestion(false);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load next question");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, sessionStatus, currentPrompt, pendingPromptFromHistory]);

  async function handleSubmit() {
    if (!sessionId || !currentPrompt || !answer.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/answer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: currentPrompt.questionId,
          sessionQuestionId: currentPrompt.sessionQuestionId,
          answer,
        }),
      });
      const json = await readJsonResponse<SubmitAnswerResponse & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Failed to submit answer");

      setLastSubmission({ result: json.result, feedback: json.feedback });
      setAnswer("");
      const results = await loadResults();

      if (json.continue_thread) {
        const pending = results?.questions?.find((q) => q.result === null);
        if (pending) {
          setCurrentPrompt({
            questionId: pending.question_id || String(pending.id),
            sessionQuestionId: pending.id,
            stem: displayQuestionText(pending.question_text),
            acsTask: pending.acs_task,
            acsArea: pending.acs_area,
            kind: pending.is_probe ? "probe" : "base",
          });
          setLastSubmission(null);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setBusy(false);
    }
  }

  async function handleNextQuestion() {
    if (!sessionId || sessionStatus !== "active") return;
    setBusy(true);
    setError(null);
    try {
      setCurrentPrompt(null);
      await requestNextQuestion(false);
      setLastSubmission(null);
      await loadResults();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load next question");
    } finally {
      setBusy(false);
    }
  }

  async function handleSkipPrompt() {
    if (!sessionId || sessionStatus !== "active") return;
    setBusy(true);
    setError(null);
    try {
      setAnswer("");
      setCurrentPrompt(null);
      await requestNextQuestion(true);
      setLastSubmission(null);
      await loadResults();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch a new prompt");
    } finally {
      setBusy(false);
    }
  }

  function handleExportNotes() {
    const notesSections: string[] = [];

    for (const row of questions) {
      const timestamp = new Date(row.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      notesSections.push(`[${timestamp}] AI Question:\n${displayQuestionText(row.question_text)}`);

      if (row.user_answer) {
        notesSections.push(`[${timestamp}] Your Answer:\n${row.user_answer}`);
      }

      if (row.ai_feedback) {
        notesSections.push(`[${timestamp}] AI Feedback:\n${row.ai_feedback}`);
      }
    }

    if (activePrompt && !questions.find((row) => row.id === activePrompt.sessionQuestionId)) {
      notesSections.push(`[Current] AI Question:\n${activePrompt.stem}`);
    }

    if (lastSubmission) {
      notesSections.push(`[Current] AI Feedback (${lastSubmission.result}):\n${lastSubmission.feedback}`);
    }

    const blob = new Blob([notesSections.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `session-${sessionId || "notes"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const currentStatus = humanResult(threadAnswered.at(-1)?.result || null);
  const progressValue =
    sessionStatus === "completed"
      ? 100
      : Math.max(
          activePrompt ? 12 : 0,
          Math.min(92, Math.round(((threadAnswered.length + (activePrompt ? 1 : 0)) / Math.max(threadAnswered.length + 1, 1)) * 100))
        );

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 pb-8 pt-2 sm:px-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Session {sessionId ? shortId(sessionId) : "-"}</span>
              <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/50 sm:inline-block" />
              <span>{activePrompt?.acsArea || "Topic loading"}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Oral Exam Session</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-[#1e3a5f] backdrop-blur-sm">
                {activePrompt?.acsTask || "ACS task pending"}
              </span>
              <StatusBadge status={sessionStatus === "completed" ? "PASS" : "IN_PROGRESS"} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/sessions"
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary"
            >
              Back to Sessions
            </Link>
            {sessionId && (
              <Link
                href={`/sessions/${sessionId}/debrief`}
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary"
              >
                View Debrief
              </Link>
            )}
            {sessionId && (
              <a
                href={`/api/sessions/${sessionId}/pdf`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ff6b35] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#ff5722]"
              >
                <Download className="h-4 w-4" />
                Download Debrief PDF
              </a>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Current Status: {currentStatus}</span>
            <span>{sessionStatus === "completed" ? "Session complete" : activePrompt?.kind === "probe" ? "Follow-up in progress" : "Question active"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1e3a5f] via-[#2d5a8f] to-[#5c8fd9] transition-all duration-500"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">{error}</div>}

      {sessionStatus === "completed" ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#22c55e]/10">
            <FileText className="h-8 w-8 text-[#22c55e]" />
          </div>
          <div className="mt-6 space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Session Complete</h2>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Your responses have been processed. Open the debrief to review the final evaluation and download the session report.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {sessionId && (
              <Link
                href={`/sessions/${sessionId}/debrief`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-6 py-3 font-medium text-white transition-colors hover:bg-[#2d5a8f]"
              >
                View Debrief
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {sessionId && (
              <a
                href={`/api/sessions/${sessionId}/pdf`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <Download className="h-4 w-4" />
                Download Debrief PDF
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl bg-gradient-to-br from-[#163454] via-[#1e3a5f] to-[#2d5a8f] p-8 text-white shadow-[0_20px_60px_-25px_rgba(30,58,95,0.65)]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/20">
                    Q
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium uppercase tracking-[0.18em] text-white/70">Current Question</p>
                      {activePrompt?.isScenario && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ff6b35]/20 border border-[#ff6b35]/30 text-[#ff6b35] text-xs font-medium">
                          ⛅ Live Scenario
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60">
                      {activePrompt?.kind === "probe" ? "Examiner Follow-Up" : "Primary Prompt"}
                    </p>
                  </div>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                  {activePrompt?.acsArea || "Preparing prompt"}
                </div>
              </div>

              {baseQuestionForPrompt && activePrompt?.kind === "probe" && (
                <div className="rounded-xl border border-white/15 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Base Question</p>
                  <p className="mt-2 text-sm leading-6 text-white/85">{baseQuestionForPrompt}</p>
                </div>
              )}

              <p className="max-w-4xl text-2xl font-semibold leading-relaxed text-white sm:text-[1.85rem]">
                {activePrompt?.stem || (loading ? "Loading question..." : "Waiting for next question...")}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-base font-semibold text-foreground">Your Answer</label>
                <VoiceInput
                  onTranscript={(text) => {
                    setAnswer((prev) => (prev ? prev + " " + text : text));
                  }}
                  disabled={busy || loading || isAwaitingNext}
                />
              </div>

              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="min-h-[140px] w-full resize-none rounded-xl border border-border bg-input-background px-4 py-4 text-foreground shadow-inner outline-none transition focus:border-[#1e3a5f]/40 focus:ring-2 focus:ring-[#1e3a5f]"
                disabled={busy || loading || isAwaitingNext}
              />

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleNextQuestion}
                    disabled={busy || !sessionId || !isAwaitingNext}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Next Question
                  </button>

                  <button
                    onClick={handleSkipPrompt}
                    disabled={busy || !sessionId}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#ff6b35]/20 bg-[#ff6b35]/10 px-4 py-2.5 text-sm font-medium text-[#c2410c] transition-colors hover:bg-[#ff6b35]/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Skip / New Prompt
                  </button>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || busy || !activePrompt || isAwaitingNext}
                  className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-[#ff6b35] px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-[#ff5722] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Submit Answer
                </button>
              </div>

              {lastSubmission && (
                <div className="rounded-xl border border-[#ff6b35]/20 bg-gradient-to-br from-[#ff6b35]/10 to-[#ff6b35]/5 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">AI Evaluator Feedback</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{lastSubmission.feedback}</p>
                    </div>
                    <StatusBadge status={lastSubmission.result} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Session History</h2>
                <p className="mt-1 text-sm text-muted-foreground">Questions, answers, and evaluator feedback for this thread.</p>
              </div>
              <button
                type="button"
                onClick={handleExportNotes}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Download className="h-4 w-4" />
                Export Session Notes
              </button>
            </div>

            <div className="max-h-[520px] space-y-4 overflow-y-auto p-6">
              {activeThreadQuestions.length === 0 && !activePrompt && (
                <div className="rounded-xl border border-dashed border-border bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
                  Conversation history will appear here as the session progresses.
                </div>
              )}

              {activeThreadQuestions.map((row) => (
                <div key={row.id} className="space-y-3">
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl border border-border bg-secondary/40 p-4 shadow-sm">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-medium text-white">
                          Q
                        </span>
                        <span>AI Question</span>
                        <span>{new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="leading-7 text-foreground">{displayQuestionText(row.question_text)}</p>
                    </div>
                  </div>

                  {row.user_answer && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-[#1e3a5f] p-4 text-white shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-xs text-white/75">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium text-white">
                            A
                          </span>
                          <span>Your Answer</span>
                        </div>
                        <p className="leading-7 text-white">{row.user_answer}</p>
                      </div>
                    </div>
                  )}

                  {row.ai_feedback && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl border border-[#ff6b35]/20 bg-gradient-to-br from-[#ff6b35]/10 to-[#ff6b35]/5 p-4 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff6b35] text-[10px] font-medium text-white">
                            AI
                          </span>
                          <span className="font-medium text-[#c2410c]">AI Feedback</span>
                          {row.result && <StatusBadge status={row.result} className="ml-1" />}
                        </div>
                        <p className="leading-7 text-foreground">{row.ai_feedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {activePrompt && !questions.find((row) => row.id === activePrompt.sessionQuestionId) && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl border border-border bg-secondary/40 p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-medium text-white">
                        Q
                      </span>
                      <span>AI Question</span>
                    </div>
                    <p className="leading-7 text-foreground">{activePrompt.stem}</p>
                  </div>
                </div>
              )}

              {(loading || busy) && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-border bg-secondary/40 p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-medium text-white">
                        Q
                      </span>
                      <span>AI is typing</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
