"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Send, Zap } from "lucide-react";
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
  session: { id: string; status: "active" | "completed" };
  questions: ResultQuestion[];
};

type DrillMeta = {
  is_drill?: boolean;
  drill_area?: string | null;
  drill_question_limit?: number;
  questions_completed?: number;
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
      meta?: { kind?: "base" | "probe"; is_scenario?: boolean } & DrillMeta;
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
};

type SubmissionState = { result: ResultCode; feedback: string };

type PromptState = {
  questionId: string;
  sessionQuestionId: number;
  stem: string;
  acsTask: string | null;
  acsArea: string | null;
  kind: "base" | "probe";
  isScenario?: boolean;
};

function displayQuestionText(text: string) {
  return text.replace(/^Examiner Follow-Up:\s*/i, "").trim();
}

export default function DrillPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params?.sessionId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"active" | "completed">("active");
  const [questions, setQuestions] = useState<ResultQuestion[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<PromptState | null>(null);
  const [answer, setAnswer] = useState("");
  const [lastSubmission, setLastSubmission] = useState<SubmissionState | null>(null);

  // Drill metadata
  const [drillArea, setDrillArea] = useState<string>("");
  const [drillLimit, setDrillLimit] = useState<number>(10);
  const [questionsCompleted, setQuestionsCompleted] = useState<number>(0);
  const [drillComplete, setDrillComplete] = useState(false);

  const isAwaitingNext = lastSubmission !== null;

  const answered = useMemo(() => questions.filter((q) => q.result !== null), [questions]);

  const counts = useMemo(() => {
    const pass = answered.filter((q) => q.result === "PASS").length;
    const probe = answered.filter((q) => q.result === "PROBE").length;
    const remediate = answered.filter((q) => q.result === "REMEDIATE").length;
    const fail = answered.filter((q) => q.result === "FAIL").length;
    return { pass, probe, remediate, fail };
  }, [answered]);

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
    } satisfies PromptState;
  }, [questions]);

  const activePrompt = currentPrompt || pendingPromptFromHistory;

  const activeThreadStartIndex = useMemo(() => {
    if (!activePrompt) return -1;
    const idx = questions.findIndex((q) => q.id === activePrompt.sessionQuestionId);
    return idx >= 0 ? idx : questions.length > 0 ? 0 : -1;
  }, [activePrompt, questions]);

  const activeThreadQuestions = useMemo(() => {
    if (activeThreadStartIndex < 0) return [];
    return questions.slice(activeThreadStartIndex);
  }, [activeThreadStartIndex, questions]);

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
      setDrillComplete(true);
      return;
    }

    // Capture drill metadata from first response
    if (json.meta?.is_drill) {
      if (json.meta.drill_area) setDrillArea(json.meta.drill_area);
      if (json.meta.drill_question_limit) setDrillLimit(json.meta.drill_question_limit);
      if (typeof json.meta.questions_completed === "number") {
        setQuestionsCompleted(json.meta.questions_completed);
      }
    }

    const nextPrompt: PromptState = {
      questionId: json.question.id,
      sessionQuestionId: json.question.session_question_id,
      stem: json.question.stem,
      acsTask: json.question.acs_task_code,
      acsArea: json.question.acs_area,
      kind: json.meta?.kind === "probe" ? "probe" : "base",
      isScenario: json.meta?.is_scenario === true,
    };

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
        if (!pendingPromptFromHistory) {
          await requestNextQuestion(false);
        }
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load drill");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (pendingPromptFromHistory) setCurrentPrompt(pendingPromptFromHistory);
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load next question");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sessionStatus, currentPrompt, pendingPromptFromHistory]);

  async function handleSubmit() {
    if (!sessionId || !activePrompt || !answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/answer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: activePrompt.questionId,
          sessionQuestionId: activePrompt.sessionQuestionId,
          answer,
        }),
      });
      const json = await readJsonResponse<SubmitAnswerResponse & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Failed to submit answer");

      setLastSubmission({ result: json.result, feedback: json.feedback });
      setAnswer("");
      const results = await loadResults();
      const newCompleted = results?.questions?.filter((q) => q.result !== null).length ?? 0;
      setQuestionsCompleted(newCompleted);

      if (newCompleted >= drillLimit) {
        setDrillComplete(true);
        setCurrentPrompt(null);
        return;
      }

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
    if (!sessionId || sessionStatus !== "active" || drillComplete) return;
    setBusy(true);
    setError(null);
    try {
      setCurrentPrompt(null);
      setLastSubmission(null);
      const results = await loadResults();
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
      } else {
        await requestNextQuestion(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load next question");
    } finally {
      setBusy(false);
    }
  }

  async function handleDrillAgain() {
    if (!drillArea || !activePrompt?.acsTask) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sessions/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acs_task_code: activePrompt?.acsTask || questions[0]?.acs_task,
          acs_area: drillArea,
        }),
      });
      const data = await readJsonResponse<{ sessionId?: string }>(res);
      if (data.sessionId) {
        router.push(`/sessions/${data.sessionId}/drill`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start new drill");
    } finally {
      setBusy(false);
    }
  }

  const progressPct = drillLimit > 0 ? Math.min(100, Math.round((questionsCompleted / drillLimit) * 100)) : 0;

  const displayArea = drillArea || activePrompt?.acsArea || "Drill Mode";

  if (drillComplete || sessionStatus === "completed") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-8 pt-8 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#22c55e]/10">
            <CheckCircle2 className="h-9 w-9 text-[#22c55e]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Drill Complete!</h2>
            <p className="text-muted-foreground">
              You completed {drillLimit} {displayArea} questions
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "PASS", count: counts.pass, color: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20" },
              { label: "PROBE", count: counts.probe, color: "bg-[#1e3a5f]/10 text-[#1e3a5f] border-[#1e3a5f]/20" },
              { label: "REMEDIATE", count: counts.remediate, color: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20" },
              { label: "FAIL", count: counts.fail, color: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20" },
            ].map(({ label, count, color }) => (
              <div key={label} className={`flex flex-col items-center px-4 py-2 rounded-lg border ${color}`}>
                <span className="text-xl font-bold">{count}</span>
                <span className="text-xs font-medium mt-0.5">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Keep drilling to improve your mastery score
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={handleDrillAgain}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              Drill Again
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 pb-8 pt-2 sm:px-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Debrief
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b35]/10 border border-[#ff6b35]/20 px-3 py-1 text-xs font-semibold text-[#ff6b35]">
              <Zap className="h-3 w-3" />
              Drill Mode
            </span>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {questionsCompleted} / {drillLimit} questions
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-foreground">{displayArea}</h1>

        <div className="space-y-1.5">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-[#ff6b35] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progressPct}% complete</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {/* Question Card */}
      <section className="overflow-hidden rounded-xl bg-gradient-to-br from-[#163454] via-[#1e3a5f] to-[#2d5a8f] p-8 text-white shadow-[0_20px_60px_-25px_rgba(30,58,95,0.65)]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/20">
                Q
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium uppercase tracking-[0.18em] text-white/70">
                    {activePrompt?.kind === "probe" ? "Examiner Follow-Up" : "Current Question"}
                  </p>
                  {activePrompt?.isScenario && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ff6b35]/20 border border-[#ff6b35]/30 text-[#ff6b35] text-xs font-medium">
                      ⛅ Live Scenario
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/60">{activePrompt?.acsArea || "Preparing prompt"}</p>
              </div>
            </div>
          </div>

          <p className="max-w-4xl text-2xl font-semibold leading-relaxed text-white sm:text-[1.85rem]">
            {activePrompt?.stem || (loading ? "Loading question..." : "Waiting for next question...")}
          </p>
        </div>
      </section>

      {/* Answer Area */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-base font-semibold text-foreground">Your Answer</label>
            <VoiceInput
              onTranscript={(text) => setAnswer((prev) => (prev ? prev + " " + text : text))}
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

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || busy || !activePrompt || isAwaitingNext}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ff6b35] px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-[#ff5722] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Submit Answer
            </button>
          </div>

          {lastSubmission && (
            <div className="rounded-xl border border-[#ff6b35]/20 bg-gradient-to-br from-[#ff6b35]/10 to-[#ff6b35]/5 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">AI Evaluator Feedback</p>
                  <p className="mt-1 text-sm leading-6 text-foreground">{lastSubmission.feedback}</p>
                </div>
                <StatusBadge status={lastSubmission.result} />
              </div>
              <div className="flex items-center gap-4 pt-1 border-t border-[#ff6b35]/10">
                <button
                  onClick={handleNextQuestion}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Next Question
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDrillComplete(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  End Drill
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Session History */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <h2 className="text-base font-semibold text-foreground">Drill History</h2>
          <p className="mt-1 text-sm text-muted-foreground">Questions and feedback from this drill session.</p>
        </div>

        <div className="max-h-[520px] space-y-4 overflow-y-auto p-6">
          {activeThreadQuestions.length === 0 && !activePrompt && (
            <div className="rounded-xl border border-dashed border-border bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
              Drill history will appear here as you answer questions.
            </div>
          )}

          {activeThreadQuestions.map((row) => (
            <div key={row.id} className="space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl border border-border bg-secondary/40 p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-medium text-white">Q</span>
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium text-white">A</span>
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff6b35] text-[10px] font-medium text-white">AI</span>
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
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-medium text-white">Q</span>
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
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-medium text-white">Q</span>
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
    </div>
  );
}
