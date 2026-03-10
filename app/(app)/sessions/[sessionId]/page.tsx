"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Download, FileText, Send } from "lucide-react";
import { StatusBadge } from "@/components/figma/StatusBadge";
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

    setCurrentPrompt({
      questionId: json.question.id,
      sessionQuestionId: json.question.session_question_id,
      stem: json.question.stem,
      acsTask: json.question.acs_task_code,
      acsArea: json.question.acs_area,
      kind: json.meta?.kind === "probe" ? "probe" : "base",
    });
    setLastSubmission(null);
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
      await requestNextQuestion(true);
      setLastSubmission(null);
      await loadResults();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch a new prompt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Oral Session</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Session {sessionId ? shortId(sessionId) : "-"}</span>
            {sessionId && (
              <Link href={`/sessions/${sessionId}/debrief`} className="text-[#1e3a5f] hover:text-[#2d5a8f] font-medium">
                View Debrief
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sessions"
            className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors"
          >
            Back to Sessions
          </Link>
          {sessionId && (
            <Link
              href={`/sessions/${sessionId}/debrief`}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors"
            >
              View Debrief
            </Link>
          )}
          {sessionId && (
            <a
              href={`/api/sessions/${sessionId}/pdf`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff6b35] hover:bg-[#ff5722] text-white transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Debrief PDF
            </a>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-md px-2.5 py-1 border font-medium bg-[#1e3a5f]/10 text-[#1e3a5f] border-[#1e3a5f]/20">
          {activePrompt?.acsTask || "ACS task pending"}
        </span>
        <span className="inline-flex items-center rounded-md px-2.5 py-1 border font-medium bg-secondary text-secondary-foreground border-border">
          {activePrompt?.acsArea || "Topic loading"}
        </span>
        <StatusBadge status={sessionStatus === "completed" ? "PASS" : "IN_PROGRESS"} />
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Question Thread</h2>

        <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Base Question</p>
          <p className="text-foreground">{baseQuestionForPrompt || "Loading base question..."}</p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {activePrompt?.kind === "probe" ? "Examiner Follow-Up" : "Prompt"}
          </p>
          <p className="text-foreground">{activePrompt?.stem || "Loading prompt..."}</p>
        </div>

        {threadAnswered.length > 0 && (
          <div className="space-y-3 pt-2">
            {threadAnswered.map((row, idx) => (
              <div key={row.id} className="rounded-lg border border-border p-4 bg-background/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">
                    Thread Item {idx + 1}
                    {row.is_probe ? " - Examiner Follow-Up" : ""}
                  </div>
                  <StatusBadge status={row.result || "IN_PROGRESS"} />
                </div>
                <div className="text-sm text-foreground">
                  <span className="font-medium">Question:</span> {displayQuestionText(row.question_text)}
                </div>
                <div className="text-sm text-foreground">
                  <span className="font-medium">Your Answer:</span> {row.user_answer || "No answer"}
                </div>
                <div className="text-sm text-foreground">
                  <span className="font-medium">Examiner Feedback:</span> {row.ai_feedback || "No feedback"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <label className="block text-sm font-medium text-foreground">Your Answer</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer here..."
          className="w-full min-h-[140px] p-4 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] resize-none"
          disabled={busy || loading || sessionStatus === "completed" || isAwaitingNext}
        />

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || busy || !activePrompt || sessionStatus === "completed" || isAwaitingNext}
            className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
            Submit Answer
          </button>

          <button
            onClick={handleNextQuestion}
            disabled={busy || !sessionId || sessionStatus === "completed" || !isAwaitingNext}
            className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRight className="h-4 w-4" />
            Next Question
          </button>

          <button
            onClick={handleSkipPrompt}
            disabled={busy || !sessionId || sessionStatus === "completed"}
            className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRight className="h-4 w-4" />
            Skip / New Prompt
          </button>
        </div>

        {lastSubmission && (
          <div className="rounded-lg border border-border p-4 bg-secondary/30 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">AI Evaluator Feedback</div>
              <StatusBadge status={lastSubmission.result} />
            </div>
            <p className="text-sm text-foreground">{lastSubmission.feedback}</p>
          </div>
        )}

        {sessionStatus === "completed" && (
          <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#166534] px-4 py-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Session is complete. Open the debrief for final results.
          </div>
        )}
      </div>

      <div className="text-sm text-muted-foreground">Current status: {humanResult(threadAnswered.at(-1)?.result || null)}</div>
    </div>
  );
}
