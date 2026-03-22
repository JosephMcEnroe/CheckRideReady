"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "@/components/figma/StatusBadge";
import { readJsonResponse } from "@/lib/http";

interface ACSArea {
  code: string;
  name: string;
  masteryPct: number;
  attempts: number;
  passes: number;
  fails: number;
  status: "Strong" | "Developing" | "Needs Work" | "Not Started";
}

interface RecentSession {
  id: string;
  mode: string;
  topic: string;
  score: number | null;
  result: string;
  date: string;
}

interface ProgressData {
  readiness: number;
  stats: {
    totalSessions: number;
    questionsAnswered: number;
    passRate: number;
    weakestArea: string;
  };
  acsAreas: ACSArea[];
  recentSessions: RecentSession[];
}

function getReadinessColor(pct: number) {
  if (pct >= 80) return "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30";
  if (pct >= 50) return "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30";
  return "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30";
}

function getMasteryStyle(masteryPct: number | null, status: string) {
  if (status === "Not Started")
    return {
      border: "border-l-4 border-l-gray-300",
      bg: "bg-gray-50",
      badgeColor: "bg-gray-100 text-gray-500",
    };
  if (masteryPct !== null && masteryPct >= 80)
    return {
      border: "border-l-4 border-l-[#22c55e]",
      bg: "bg-[#22c55e]/5",
      badgeColor: "bg-[#22c55e]/10 text-[#22c55e]",
    };
  if (masteryPct !== null && masteryPct >= 60)
    return {
      border: "border-l-4 border-l-[#fbbf24]",
      bg: "bg-[#fbbf24]/5",
      badgeColor: "bg-[#fbbf24]/10 text-[#fbbf24]",
    };
  if (masteryPct !== null && masteryPct >= 40)
    return {
      border: "border-l-4 border-l-[#fb923c]",
      bg: "bg-[#fb923c]/5",
      badgeColor: "bg-[#fb923c]/10 text-[#fb923c]",
    };
  return {
    border: "border-l-4 border-l-[#ef4444]",
    bg: "bg-[#ef4444]/5",
    badgeColor: "bg-[#ef4444]/10 text-[#ef4444]",
  };
}

function getBarColor(masteryPct: number | null, status: string) {
  if (status === "Not Started") return "bg-gray-200";
  if (masteryPct !== null && masteryPct >= 80) return "bg-[#22c55e]";
  if (masteryPct !== null && masteryPct >= 60) return "bg-[#fbbf24]";
  if (masteryPct !== null && masteryPct >= 40) return "bg-[#fb923c]";
  return "bg-[#ef4444]";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProgressPage() {
  const router = useRouter();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/progress")
      .then((res) => readJsonResponse<ProgressData>(res))
      .then((d) => setData(d))
      .catch((e) => setError(e?.message ?? "Failed to load progress"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto space-y-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 h-20 bg-gray-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-lg border border-border h-28 bg-gray-100" />
          ))}
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-border bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1100px] mx-auto flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-red-500 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[#1e3a5f] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data || data.stats.totalSessions === 0) {
    return (
      <div className="max-w-[1100px] mx-auto flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground text-lg">No sessions yet</p>
        <button
          onClick={() => router.push("/start")}
          className="bg-[#ff6b35] hover:bg-[#ff5722] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Start your first session
        </button>
      </div>
    );
  }

  const { readiness, stats, acsAreas, recentSessions } = data;
  const isReady = readiness >= 80;

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-foreground">My Progress</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your oral exam readiness across all ACS knowledge areas
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border text-lg font-semibold ${getReadinessColor(readiness)}`}
        >
          {readiness}% Ready
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions", value: stats.totalSessions, icon: Clock, color: "text-[#1e3a5f]" },
          { label: "Questions Answered", value: stats.questionsAnswered, icon: MessageSquare, color: "text-[#1e3a5f]" },
          { label: "Overall Pass Rate", value: `${stats.passRate}%`, icon: TrendingUp, color: "text-[#22c55e]" },
          { label: "Weakest Area", value: stats.weakestArea, icon: AlertTriangle, color: "text-[#ff6b35]" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card rounded-lg border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#1e3a5f]/5">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{stat.label}</p>
                <p className="text-foreground text-lg font-semibold">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-foreground mb-1">ACS Knowledge Areas</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Color coded by your mastery level across all sessions
        </p>
        {acsAreas.length === 0 ? (
          <p className="text-muted-foreground text-sm">No ACS data yet. Complete more sessions to see your mastery.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {acsAreas.map((area) => {
              const style = getMasteryStyle(area.masteryPct, area.status);
              return (
                <div
                  key={area.code}
                  className={`${style.border} ${style.bg} rounded-lg border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="p-4 space-y-3">
                    <p className="text-foreground text-sm font-medium">{area.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-2xl font-semibold">
                        {area.status !== "Not Started" ? `${area.masteryPct}%` : "—"}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${style.badgeColor}`}>
                        {area.status}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100">
                    <div
                      className={`h-full ${getBarColor(area.masteryPct, area.status)} transition-all`}
                      style={{ width: area.status !== "Not Started" ? `${area.masteryPct}%` : "0%" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-foreground mb-4">Recent Sessions</h2>
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {recentSessions.map((session, index) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      Session #{recentSessions.length - index}
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDate(session.date)}</p>
                  </div>
                  <span className="text-muted-foreground text-sm hidden sm:inline">·</span>
                  <span className="text-foreground text-sm">{session.topic}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-foreground text-sm font-medium">
                    {session.score !== null ? `${session.score}%` : "—"}
                  </span>
                  <StatusBadge status={session.result as "PASS" | "PROBE" | "REMEDIATE" | "FAIL" | "IN_PROGRESS"} />
                  <Link
                    href={`/sessions/${session.id}/debrief`}
                    className="text-[#1e3a5f] text-sm hover:underline flex items-center gap-1"
                  >
                    View Debrief <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isReady ? (
        <div className="rounded-lg border border-[#fbbf24]/30 bg-[#fbbf24]/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-2.5 rounded-full bg-[#fbbf24]/10">
            <AlertTriangle className="h-6 w-6 text-[#fbbf24]" />
          </div>
          <div className="flex-1">
            <p className="text-foreground font-semibold">Not quite ready yet</p>
            <p className="text-muted-foreground text-sm mt-0.5">
              Focus on your weakest areas before scheduling your checkride
            </p>
          </div>
          <button
            onClick={() => router.push("/start")}
            className="bg-[#ff6b35] hover:bg-[#ff5722] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Focus on Weak Areas
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-2.5 rounded-full bg-[#22c55e]/10">
            <CheckCircle2 className="h-6 w-6 text-[#22c55e]" />
          </div>
          <div className="flex-1">
            <p className="text-foreground font-semibold">You&apos;re checkride ready!</p>
            <p className="text-muted-foreground text-sm mt-0.5">
              You&apos;ve demonstrated consistent knowledge across all ACS areas. Time to schedule with your DPE.
            </p>
          </div>
          <button
            onClick={() => alert("Coming soon")}
            className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Download Readiness Report
          </button>
        </div>
      )}
    </div>
  );
}
