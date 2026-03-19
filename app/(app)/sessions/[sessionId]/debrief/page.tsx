import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/figma/StatusBadge";
import { CfiNotesSection } from "@/components/figma/CfiNotesSection";
import { ShareDebriefButton } from "@/components/figma/ShareDebriefButton";
import { getSessionResults } from "@/lib/session-results";
import { computeOverallGrade, PASSING_SCORE_PERCENT } from "@/lib/session-grading";
import { auth } from "@/auth";

type ResultCode = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

function getScorePercent(results: Array<ResultCode | null>) {
  const graded = results.filter((r): r is ResultCode => r !== null);
  if (graded.length === 0) return 0;

  const weights: Record<ResultCode, number> = {
    PASS: 1,
    PROBE: 0.75,
    REMEDIATE: 0.5,
    FAIL: 0,
  };

  const avg = graded.reduce((sum, r) => sum + weights[r], 0) / graded.length;
  return Math.round(avg * 100);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not available";
  return d.toLocaleString();
}

function formatDuration(start: string | null, end: string | null) {
  if (!start) return "Not available";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return "Not available";

  const totalMin = Math.round((endMs - startMs) / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours}h ${mins}m`;
}

function deriveTopic(acsTasks: Array<string | null>) {
  const buckets = new Map<string, number>();
  for (const task of acsTasks) {
    if (!task) continue;
    buckets.set(task, (buckets.get(task) || 0) + 1);
  }
  if (buckets.size === 0) return "Not available yet";

  const [top] = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  return top[0];
}

function splitFeedbackIntoPoints(text: string) {
  return text
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function deriveStrengths(feedback: Array<{ result: ResultCode | null; ai_feedback: string | null }>, overall: string | null) {
  const points = new Set<string>();

  for (const f of feedback) {
    if (f.result !== "PASS" || !f.ai_feedback) continue;
    for (const sentence of splitFeedbackIntoPoints(f.ai_feedback)) {
      if (points.size >= 5) break;
      points.add(sentence);
    }
  }

  if (points.size === 0 && overall) {
    for (const sentence of splitFeedbackIntoPoints(overall)) {
      if (points.size >= 3) break;
      if (/strong|clear|good|excellent|solid/i.test(sentence)) points.add(sentence);
    }
  }

  return points.size > 0 ? [...points] : ["Not available yet. Complete more graded questions to generate strengths."];
}

function deriveImprovements(feedback: Array<{ result: ResultCode | null; ai_feedback: string | null }>, overall: string | null) {
  const points = new Set<string>();

  for (const f of feedback) {
    if (f.result === "PASS" || !f.ai_feedback) continue;
    for (const sentence of splitFeedbackIntoPoints(f.ai_feedback)) {
      if (points.size >= 5) break;
      points.add(sentence);
    }
  }

  if (points.size === 0 && overall) {
    for (const sentence of splitFeedbackIntoPoints(overall)) {
      if (points.size >= 3) break;
      if (/improv|review|missing|incorrect|need/i.test(sentence)) points.add(sentence);
    }
  }

  return points.size > 0 ? [...points] : ["Not available yet. Submit additional answers to identify improvement areas."];
}

export default async function DebriefPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <p className="text-foreground">Unauthorized.</p>
        <Link href="/login" className="text-[#1e3a5f] hover:text-[#2d5a8f]">
          Go to Login
        </Link>
      </div>
    );
  }

  const data = await getSessionResults(sessionId, userId);

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <p className="text-foreground">Session not found.</p>
        <Link href="/sessions" className="text-[#1e3a5f] hover:text-[#2d5a8f]">
          Back to Sessions
        </Link>
      </div>
    );
  }

  const gradedQuestions = data.questions.filter((q) => q.result !== null || q.user_answer || q.ai_feedback);

  const score = getScorePercent(data.questions.map((q) => q.result));
  const rawStatus =
    data.session.overall_grade ||
    computeOverallGrade({
      passCount: data.counts.passCount,
      probeCount: data.counts.probeCount,
      remediateCount: data.counts.remediateCount,
      failCount: data.counts.failCount,
    });
  const status: ResultCode = rawStatus === "PASS" && score < PASSING_SCORE_PERCENT ? "FAIL" : rawStatus;

  const topic = deriveTopic(data.questions.map((q) => q.acs_task));
  const duration = formatDuration(data.session.started_at, data.session.ended_at);
  const startedAt = formatDateTime(data.session.started_at);

  const strengths = deriveStrengths(data.questions, data.session.overall_summary);
  const improvements = deriveImprovements(data.questions, data.session.overall_summary);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sessions" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back to Sessions</span>
        </Link>
      </div>

      <div className="bg-gradient-to-br from-white to-[#f8f9fa] rounded-xl border-2 border-[#1e3a5f] p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  status === "FAIL" ? "bg-[#ef4444]/10" : "bg-[#22c55e]/10"
                }`}
              >
                {status === "FAIL" ? (
                  <XCircle className="h-7 w-7 text-[#ef4444]" />
                ) : (
                  <CheckCircle2 className="h-7 w-7 text-[#22c55e]" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-foreground">Session Debrief</h1>
                <p className="text-sm text-muted-foreground">{startedAt}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Topic: </span>
                <span className="font-medium text-foreground">{topic}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration: </span>
                <span className="font-medium text-foreground">{duration}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Questions: </span>
                <span className="font-medium text-foreground">{gradedQuestions.length}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <StatusBadge status={status} className="text-lg px-4 py-2" />
            <div className="text-5xl font-bold text-[#1e3a5f]">{score}%</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <ShareDebriefButton sessionId={sessionId} />
        <a
          href={`/api/sessions/${sessionId}/pdf`}
          className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-md"
        >
          <Download className="h-4 w-4" />
          Download Debrief PDF
        </a>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Overall Feedback</h2>
        <p className="text-foreground leading-relaxed">
          {data.session.overall_summary || "Not available yet. Complete more graded questions for a richer summary."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#22c55e]" />
            <h3 className="font-semibold text-foreground">Strengths</h3>
          </div>
          <ul className="space-y-2">
            {strengths.map((strength) => (
              <li key={strength} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-[#22c55e] shrink-0 mt-0.5" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[#ff6b35]" />
            <h3 className="font-semibold text-foreground">Areas for Improvement</h3>
          </div>
          <ul className="space-y-2">
            {improvements.map((weakness) => (
              <li key={weakness} className="flex items-start gap-2 text-sm text-foreground">
                <AlertCircle className="h-4 w-4 text-[#ff6b35] shrink-0 mt-0.5" />
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Question-by-Question Breakdown</h2>
        <div className="space-y-6">
          {gradedQuestions.map((item, index) => (
            <div key={item.id} className="border border-border rounded-lg p-5 space-y-4 bg-secondary/30">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1e3a5f] text-white text-xs font-medium">
                      {index + 1}
                    </span>
                    <p className="font-medium text-foreground">{item.question_text}</p>
                  </div>
                </div>
                <StatusBadge status={(item.result || "PROBE") as ResultCode} />
              </div>
              <div className="pl-8 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">YOUR ANSWER:</p>
                  <p className="text-sm text-foreground italic">{item.user_answer || "No answer submitted."}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">EXAMINER FEEDBACK:</p>
                  <p className="text-sm text-foreground">{item.ai_feedback || "No feedback yet."}</p>
                </div>
              </div>
            </div>
          ))}

          {gradedQuestions.length === 0 && (
            <div className="border border-border rounded-lg p-5 bg-secondary/30 text-sm text-muted-foreground">
              No question records are available yet for this session.
            </div>
          )}
        </div>
      </div>

      <CfiNotesSection sessionId={sessionId} studentId={userId} />

      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <Link
          href="/sessions/new"
          className="inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-8 py-3 rounded-lg font-medium transition-colors"
        >
          Start Another Session
        </Link>
        <Link
          href="/sessions"
          className="inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-8 py-3 rounded-lg font-medium transition-colors"
        >
          View All Sessions
        </Link>
      </div>
    </div>
  );
}
