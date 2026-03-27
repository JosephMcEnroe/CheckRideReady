"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import {
  BarChart2,
  CheckCircle2,
  Plus,
  TrendingUp,
  Users,
  Calendar,
} from "lucide-react";

type AdminDashboardData = {
  schoolName: string;
  stats: {
    totalStudents: number;
    totalInstructors: number;
    sessionsThisWeek: number;
    avgScore: number | null;
  };
  instructors: Array<{ id: string; name: string | null; student_count: number; avg_score: number | null }>;
  needsAttention: Array<{ id: string; name: string | null; last_result: string; instructor_name: string | null }>;
  recentActivity: Array<{
    id: string;
    mode: string;
    overall_grade: string;
    started_at: string;
    student_name: string | null;
    score: number | null;
  }>;
  weakAreas: Array<{ code: string; failure_rate: number }>;
  readiness: { ready: number; developing: number; needsWork: number };
};

const ACS_NAMES: Record<string, string> = {
  "PA.I.A": "Pilot Qualifications",
  "PA.I.B": "Airworthiness",
  "PA.I.C": "Weather Theory",
  "PA.I.D": "Cross Country",
  "PA.I.E": "Airspace",
  "PA.I.F": "Performance",
  "PA.I.G": "Aircraft Systems",
  "PA.IV.A": "Radio Comms",
  "PA.VI.A": "Emergencies",
  "PA.VII.A": "Night Ops",
  "PA.VIII.A": "Navigation",
};
const getAreaName = (code: string) => ACS_NAMES[code] || code;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getInitials(name: string | null) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const resultColors: Record<string, string> = {
  PASS: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20",
  PROBE: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
  REMEDIATE: "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20",
  FAIL: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20",
};

const weakAreaDotColors = [
  "bg-[#ef4444]",
  "bg-[#fb923c]",
  "bg-[#fbbf24]",
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/dashboard");
        const json = await readJsonResponse<AdminDashboardData & { error?: string }>(res);
        if (!res.ok) {
          if (res.status === 403) {
            router.replace("/dashboard");
            return;
          }
          throw new Error(json.error || "Failed to load");
        }
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <div className="h-8 w-56 bg-muted rounded" />
            <div className="h-4 w-72 bg-muted rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-36 bg-muted rounded-lg" />
            <div className="h-9 w-36 bg-muted rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 h-72 bg-muted rounded-xl" />
          <div className="lg:col-span-3 h-72 bg-muted rounded-xl" />
          <div className="lg:col-span-4 h-72 bg-muted rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { schoolName, stats, instructors, needsAttention, recentActivity, weakAreas, readiness } = data;
  const totalReadiness = readiness.ready + readiness.developing + readiness.needsWork;

  const metrics = [
    { title: "Total Students", value: String(stats.totalStudents), icon: Users, color: "text-[#1e3a5f]" },
    { title: "Total Instructors", value: String(stats.totalInstructors), icon: Users, color: "text-[#1e3a5f]" },
    { title: "Sessions This Week", value: String(stats.sessionsThisWeek), icon: Calendar, color: "text-[#1e3a5f]" },
    {
      title: "School Avg Score",
      value: stats.avgScore !== null ? `${stats.avgScore}%` : "—",
      icon: TrendingUp,
      color: "text-[#22c55e]",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{schoolName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">School overview — {today}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push("/school/invite?tab=instructor")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#1e3a5f] text-sm font-medium hover:bg-[#1e3a5f]/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite Instructor
          </button>
          <button
            onClick={() => router.push("/school/invite?tab=student")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff6b35] hover:bg-[#ff5722] text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite Student
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.title} className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{metric.title}</span>
              <div className="h-8 w-8 rounded-lg bg-[#1e3a5f]/5 flex items-center justify-center">
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Col 1 — Instructors (col-span-5) */}
        <div className="lg:col-span-5 bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h2 className="text-foreground font-semibold">Instructors</h2>
            <span className="text-xs text-muted-foreground">{instructors.length} total</span>
          </div>
          <div className="divide-y divide-border">
            {instructors.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No instructors yet</p>
            ) : (
              instructors.map((inst) => {
                const initials = getInitials(inst.name);
                const barPct = stats.totalStudents > 0
                  ? Math.min(100, Math.round((inst.student_count / stats.totalStudents) * 100))
                  : 0;
                return (
                  <button
                    key={inst.id}
                    onClick={() => router.push("/school/students")}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-medium shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {inst.name || "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1e3a5f] rounded-full"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {inst.student_count} student{inst.student_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold text-foreground">
                        {inst.avg_score !== null ? `${inst.avg_score}%` : "—"}
                      </span>
                      <p className="text-xs text-muted-foreground">avg</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="px-5 py-3 border-t border-border">
            <button
              onClick={() => router.push("/school/invite?tab=instructor")}
              className="w-full py-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-[#1e3a5f]/40 hover:text-[#1e3a5f] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Instructor
            </button>
          </div>
        </div>

        {/* Col 2 — Needs Attention (col-span-3) */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-foreground font-semibold">Needs Attention</h2>
          </div>
          {needsAttention.length === 0 ? (
            <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
              <div className="h-10 w-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-[#22c55e]" />
              </div>
              <p className="text-sm font-medium text-foreground">All students on track</p>
              <p className="text-xs text-muted-foreground">No recent FAIL or REMEDIATE results</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {needsAttention.map((student) => {
                const initials = getInitials(student.name);
                return (
                  <div key={student.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center text-xs font-medium shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {student.name || "Unknown"}
                      </p>
                      {student.instructor_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {student.instructor_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${
                            resultColors[student.last_result] || resultColors.PROBE
                          }`}
                        >
                          {student.last_result}
                        </span>
                        <button
                          onClick={() => router.push(`/instructor/${student.id}`)}
                          className="text-xs text-[#1e3a5f] hover:underline font-medium"
                        >
                          Review →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Col 3 — Live Activity (col-span-4) */}
        <div className="lg:col-span-4 bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" />
            <h2 className="text-foreground font-semibold">Live Activity</h2>
          </div>
          {recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">No recent activity</p>
          ) : (
            <div className="divide-y divide-border">
              {recentActivity.map((item) => {
                const initials = getInitials(item.student_name);
                return (
                  <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] flex items-center justify-center text-xs font-medium shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.student_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.mode}
                        {item.score !== null && ` · ${item.score}%`}
                        {" · "}
                        {timeAgo(item.started_at)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border shrink-0 ${
                        resultColors[item.overall_grade] || resultColors.PROBE
                      }`}
                    >
                      {item.overall_grade}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ACS Weak Areas */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-5 w-5 text-[#1e3a5f]" />
            <h2 className="text-foreground font-semibold">ACS Weak Areas</h2>
            <span className="text-xs text-muted-foreground ml-1">School-wide</span>
          </div>
          {weakAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data yet</p>
          ) : (
            <div className="space-y-4">
              {weakAreas.map((area, i) => (
                <div key={area.code}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${weakAreaDotColors[i] || "bg-gray-400"}`} />
                    <p className="text-sm font-medium text-foreground flex-1">{getAreaName(area.code)}</p>
                    <span className="text-xs font-mono text-muted-foreground">{area.code}</span>
                    <span className="text-sm font-semibold text-foreground">{area.failure_rate}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${weakAreaDotColors[i] || "bg-gray-400"}`}
                      style={{ width: `${area.failure_rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkride Readiness */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-foreground font-semibold">Checkride Readiness</h2>
            <button
              onClick={() => router.push("/school/analytics")}
              className="text-xs text-[#1e3a5f] hover:underline font-medium"
            >
              View Full Analytics →
            </button>
          </div>
          {totalReadiness === 0 ? (
            <p className="text-sm text-muted-foreground">No student data yet</p>
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: "Ready",
                  count: readiness.ready,
                  color: "bg-[#22c55e]/10",
                  dot: "bg-[#22c55e]",
                  text: "text-[#22c55e]",
                  desc: "≥ 80% mastery",
                },
                {
                  label: "Developing",
                  count: readiness.developing,
                  color: "bg-[#fbbf24]/10",
                  dot: "bg-[#fbbf24]",
                  text: "text-[#fbbf24]",
                  desc: "50–79% mastery",
                },
                {
                  label: "Needs Work",
                  count: readiness.needsWork,
                  color: "bg-[#ef4444]/10",
                  dot: "bg-[#ef4444]",
                  text: "text-[#ef4444]",
                  desc: "< 50% mastery",
                },
              ].map((tier) => (
                <div
                  key={tier.label}
                  className={`${tier.color} rounded-lg px-4 py-3 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${tier.dot}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{tier.label}</p>
                      <p className="text-xs text-muted-foreground">{tier.desc}</p>
                    </div>
                  </div>
                  <span className={`text-2xl font-bold ${tier.text}`}>{tier.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
