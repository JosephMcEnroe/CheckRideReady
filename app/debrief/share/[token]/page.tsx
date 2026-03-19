"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Plane } from "lucide-react";

type ResultCode = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

type Question = {
  question_text: string;
  user_answer: string | null;
  ai_feedback: string | null;
  result: ResultCode | null;
  acs_task: string | null;
};

type DebriefData = {
  session: {
    id: string;
    mode: string;
    overall_grade: string | null;
    overall_summary: string | null;
    started_at: string;
  };
  questions: Question[];
  score: number;
  studentFirstName: string;
};

const gradeColors: Record<string, string> = {
  PASS: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20",
  PROBE: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
  REMEDIATE: "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20",
  FAIL: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20",
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function splitFeedbackIntoPoints(text: string) {
  return text
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function deriveStrengths(questions: Question[]) {
  const points = new Set<string>();
  for (const q of questions) {
    if (q.result !== "PASS" || !q.ai_feedback) continue;
    for (const sentence of splitFeedbackIntoPoints(q.ai_feedback)) {
      if (points.size >= 5) break;
      points.add(sentence);
    }
  }
  return [...points];
}

function deriveImprovements(questions: Question[]) {
  const points = new Set<string>();
  for (const q of questions) {
    if (q.result === "PASS" || !q.ai_feedback) continue;
    for (const sentence of splitFeedbackIntoPoints(q.ai_feedback)) {
      if (points.size >= 5) break;
      points.add(sentence);
    }
  }
  return [...points];
}

export default function ShareableDebriefPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<DebriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/debrief/share/${token}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  function toggleQuestion(index: number) {
    setExpandedQuestions((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading debrief...</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-14 w-14 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-[#ef4444]" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Debrief Not Found</h1>
          <p className="text-muted-foreground text-sm">
            This debrief link is invalid or has expired.
          </p>
          <Link
            href="/"
            className="inline-block bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const strengths = deriveStrengths(data.questions);
  const improvements = deriveImprovements(data.questions);
  const grade = data.session.overall_grade || "PROBE";

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <div className="bg-white border-b border-border">
        <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]">
              <Plane className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[#1e3a5f]">CheckRideReady</span>
          </div>
          <Link
            href="/login"
            className="bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Create Free Account
          </Link>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 py-8 space-y-6">
        {/* Main debrief card */}
        <div className="bg-card rounded-xl border border-border p-8 shadow-sm space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Session Debrief</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{data.studentFirstName}</span>
                <span>·</span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-xs">{data.session.mode}</span>
                <span>·</span>
                <span>{formatDate(data.session.started_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-[#1e3a5f]">{data.score}%</span>
              <span
                className={`inline-flex items-center rounded-md px-3 py-1.5 border font-medium text-sm ${
                  gradeColors[grade] || gradeColors.PROBE
                }`}
              >
                {grade}
              </span>
            </div>
          </div>

          {/* Overall feedback */}
          {data.session.overall_summary && (
            <p className="text-foreground leading-relaxed">{data.session.overall_summary}</p>
          )}

          {/* Strengths + Improvements */}
          {(strengths.length > 0 || improvements.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {strengths.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
                    Strengths
                  </h3>
                  <ul className="space-y-2">
                    {strengths.map((s, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e] shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {improvements.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#ff6b35]" />
                    Areas to Improve
                  </h3>
                  <ul className="space-y-2">
                    {improvements.map((s, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-[#ff6b35] shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Question Breakdown */}
          {data.questions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Question Breakdown</h3>
              {data.questions.map((q, i) => {
                const result = q.result || "PROBE";
                const expanded = expandedQuestions.includes(i);
                return (
                  <div key={i} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleQuestion(i)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1e3a5f] text-white text-xs shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground truncate">{q.question_text}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 border font-medium text-xs ${
                            gradeColors[result] || gradeColors.PROBE
                          }`}
                        >
                          {result}
                        </span>
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">YOUR ANSWER:</p>
                          <p className="text-sm text-foreground italic">
                            {q.user_answer || "No answer submitted."}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">FEEDBACK:</p>
                          <p className="text-sm text-foreground">{q.ai_feedback || "No feedback."}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="bg-[#1e3a5f] rounded-xl p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold text-white">Want to practice like this?</h2>
          <p className="text-white/70 text-sm">
            CheckRideReady simulates your FAA oral exam with an AI examiner.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#ff6b35] hover:bg-[#ff5722] text-white px-8 py-3 rounded-lg font-medium transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>
  );
}
