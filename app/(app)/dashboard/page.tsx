"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Plane, PlayCircle, TrendingUp, Trophy } from "lucide-react";
import { StatusBadge } from "@/components/figma/StatusBadge";
import { readJsonResponse } from "@/lib/http";

type ResultCode = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

type SessionListItem = {
  id: string;
  created_at: string;
  topic: string | null;
  last_result: ResultCode | null;
  score: number | null;
  duration_seconds: number | null;
  question_count: number | null;
};

type School = {
  id: string;
  name: string;
  icao_identifier: string | null;
  role: string;
};

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null | undefined>(undefined);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [sessionsRes, schoolRes] = await Promise.all([
          fetch("/api/sessions/list", { cache: "no-store" }),
          fetch("/api/school/mine"),
        ]);
        const sessionsJson = await readJsonResponse<{ sessions?: SessionListItem[]; error?: string }>(sessionsRes);
        if (!sessionsRes.ok) throw new Error(sessionsJson.error || "Failed to load sessions");
        setSessions(sessionsJson.sessions || []);

        const schoolJson = await readJsonResponse<{ school?: School | null }>(schoolRes);
        setSchool(schoolJson.school ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const latestSession = useMemo(() => sessions[0] || null, [sessions]);
  const completedSessions = useMemo(() => sessions.filter((s) => s.last_result !== null), [sessions]);
  const avgScore = useMemo(() => {
    const scored = completedSessions.filter((s) => s.score !== null);
    if (scored.length === 0) return null;
    const total = scored.reduce((sum, s) => sum + Number(s.score || 0), 0);
    return Math.round(total / scored.length);
  }, [completedSessions]);

  const passRate = useMemo(() => {
    if (completedSessions.length === 0) return null;
    const passes = completedSessions.filter((s) => s.last_result === "PASS").length;
    return Math.round((passes / completedSessions.length) * 100);
  }, [completedSessions]);

  const resumeTarget = latestSession
    ? latestSession.last_result
      ? `/sessions/${latestSession.id}/debrief`
      : `/sessions/${latestSession.id}`
    : "/sessions/new";

  // Brand new user — no school, no sessions
  const isNewUser = school === null && sessions.length === 0 && !loading;

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* School admin banner */}
      {school && school.role === "admin" && (
        <div className="rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-[#1e3a5f]">{school.name}</p>
            <p className="text-sm text-muted-foreground">Manage your flight school</p>
          </div>
          <Link
            href="/school/invite"
            className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Manage School
          </Link>
        </div>
      )}

      {isNewUser ? (
        /* ── Get Started (new user) ───────────────────────────────────────── */
        <>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">Welcome to ProCheckride</h1>
            <p className="text-muted-foreground">How would you like to get started?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/student/profile"
              className="block bg-card rounded-xl border-2 border-border hover:border-[#1e3a5f] p-6 shadow-sm transition-all space-y-3"
            >
              <div className="h-12 w-12 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <Plane className="h-6 w-6 text-[#1e3a5f]" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">I&apos;m a Student</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up your profile and start practicing for your checkride
                </p>
              </div>
              <span className="text-sm font-medium text-[#ff6b35]">Get started →</span>
            </Link>
          </div>
        </>
      ) : (
        /* ── Normal Dashboard ─────────────────────────────────────────────── */
        <>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">Welcome back, Pilot</h1>
            <p className="text-muted-foreground">
              Continue your checkride preparation with AI-powered oral exam simulations
            </p>
          </div>

          <div className="bg-linear-to-r from-[#1e3a5f] to-[#2d5a8f] rounded-xl p-8 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Ready for your next session?</h2>
                <p className="text-white/80">
                  Practice with our AI Designated Pilot Examiner and get instant feedback
                </p>
              </div>
              <Link
                href="/sessions/new"
                className="inline-flex items-center justify-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md"
              >
                <PlayCircle className="h-5 w-5" />
                Start New Oral Session
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                  <Clock className="h-6 w-6 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                  <p className="text-2xl font-semibold text-foreground">{sessions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                  <TrendingUp className="h-6 w-6 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {avgScore === null ? "-" : `${avgScore}%`}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                  <Trophy className="h-6 w-6 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pass Rate</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {passRate === null ? "-" : `${passRate}%`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Latest Session</h3>
                {latestSession?.last_result ? (
                  <StatusBadge status={latestSession.last_result} />
                ) : (
                  <StatusBadge status="IN_PROGRESS" />
                )}
              </div>

              {loading && <p className="text-sm text-muted-foreground">Loading latest session...</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}

              {!loading && !error && latestSession && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatDateTime(latestSession.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Topic</span>
                    <span className="text-sm font-medium text-foreground">
                      {latestSession.topic || "Untitled"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Score</span>
                    <span className="text-sm font-medium text-foreground">
                      {latestSession.score === null ? "-" : `${latestSession.score}%`}
                    </span>
                  </div>
                </div>
              )}

              {!loading && !error && !latestSession && (
                <p className="text-sm text-muted-foreground">No sessions yet. Start your first one.</p>
              )}

              <Link
                href={resumeTarget}
                className="block w-full text-center bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-medium hover:bg-secondary/80 transition-colors mt-4"
              >
                {latestSession ? "Open Latest Session" : "Start First Session"}
              </Link>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-foreground">Recent Activity</h3>
              <div className="space-y-3">
                {sessions.slice(0, 3).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {session.topic || "Untitled Session"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(session.created_at)}</p>
                    </div>
                    {session.last_result ? (
                      <StatusBadge status={session.last_result} />
                    ) : (
                      <StatusBadge status="IN_PROGRESS" />
                    )}
                  </div>
                ))}
              </div>
              <Link
                href="/sessions"
                className="block w-full text-center text-[#1e3a5f] hover:text-[#2d5a8f] font-medium mt-4 transition-colors"
              >
                View All Sessions
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
