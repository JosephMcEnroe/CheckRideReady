"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { readJsonResponse } from "@/lib/http";
import {
  AlertTriangle,
  Calendar,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";

type Student = {
  id: string;
  name: string | null;
  email: string;
  certificate_goal: string | null;
  last_session_date: string | null;
  last_result: string | null;
  last_score: number | null;
  session_count: number;
  readiness: number | null;
  weakest_area: string | null;
  status: "on-track" | "needs-review";
};

type Stats = {
  totalStudents: number;
  sessionsThisWeek: number;
  atRiskStudents: number;
  passRate: number;
};

type DashboardData = {
  stats: Stats;
  students: Student[];
};

function timeAgo(date: string | null) {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getInitials(name: string | null, email: string) {
  const source = name || email;
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function getTrackColor(track: string | null) {
  if (!track) return "bg-gray-100 text-gray-500";
  const t = track.toUpperCase();
  if (t.includes("PPL") || t.includes("PRIVATE")) return "bg-[#1e3a5f]/10 text-[#1e3a5f]";
  if (t.includes("IR") || t.includes("INSTRUMENT")) return "bg-[#3b82f6]/10 text-[#3b82f6]";
  if (t.includes("CPL") || t.includes("COMMERCIAL")) return "bg-[#ff6b35]/10 text-[#ff6b35]";
  return "bg-[#1e3a5f]/10 text-[#1e3a5f]";
}

function ReadinessBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-sm">—</span>;
  const color =
    value >= 80 ? "bg-[#22c55e]" : value >= 60 ? "bg-[#fbbf24]" : "bg-[#ef4444]";
  return (
    <div className="flex items-center gap-2 min-w-20">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export default function InstructorDashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] || "there";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/instructor/dashboard");
        const json = await readJsonResponse<DashboardData & { error?: string }>(res);
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = data?.stats;
  const students = data?.students ?? [];
  const atRiskCount = stats?.atRiskStudents ?? 0;

  const metrics = [
    { title: "Active Students", value: stats ? String(stats.totalStudents) : "—", icon: Users, color: "text-[#1e3a5f]" },
    { title: "Sessions This Week", value: stats ? String(stats.sessionsThisWeek) : "—", icon: Calendar, color: "text-[#1e3a5f]" },
    { title: "At-Risk Students", value: stats ? String(stats.atRiskStudents) : "—", icon: AlertTriangle, color: atRiskCount > 0 ? "text-[#ff6b35]" : "text-[#1e3a5f]" },
    { title: "Avg Pass Rate", value: stats ? `${stats.passRate}%` : "—", icon: TrendingUp, color: "text-[#22c55e]" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Good {getTimeOfDay()}, {name}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Here&apos;s how your students are doing today
          </p>
        </div>
        <button
          onClick={() => router.push("/school/invite?tab=student")}
          className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Invite Student
        </button>
      </div>

      {/* At-risk alert banner */}
      {!loading && atRiskCount > 0 && (
        <div className="rounded-xl border border-[#ff6b35]/30 bg-[#ff6b35]/5 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#ff6b35]/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-[#ff6b35]" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {atRiskCount} student{atRiskCount !== 1 ? "s" : ""} need{atRiskCount === 1 ? "s" : ""} attention
              </p>
              <p className="text-sm text-muted-foreground">
                Recent sessions ended with FAIL or REMEDIATE
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/instructor/students")}
            className="px-4 py-2 rounded-lg bg-[#ff6b35] hover:bg-[#ff5722] text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            Review Now
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

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

      {/* Student roster */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Your Students</h2>
          <button
            onClick={() => router.push("/instructor/students")}
            className="text-sm text-[#1e3a5f] hover:underline font-medium"
          >
            View All →
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-9 w-9 bg-muted rounded-full shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="h-3 bg-muted rounded w-16 self-center" />
                <div className="h-3 bg-muted rounded w-20 self-center" />
                <div className="h-3 bg-muted rounded w-16 self-center" />
              </div>
            ))}
          </div>
        ) : students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-left">
                  <th className="py-2.5 px-4 text-muted-foreground font-medium">Student</th>
                  <th className="py-2.5 px-4 text-muted-foreground font-medium">Track</th>
                  <th className="py-2.5 px-4 text-muted-foreground font-medium">Readiness</th>
                  <th className="py-2.5 px-4 text-muted-foreground font-medium">Last Session</th>
                  <th className="py-2.5 px-4 text-muted-foreground font-medium">Weakest Area</th>
                  <th className="py-2.5 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="py-2.5 px-4 text-muted-foreground font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((student) => {
                  const isAtRisk = student.status === "needs-review";
                  const initials = getInitials(student.name, student.email);
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-secondary/30 transition-colors${isAtRisk ? " border-l-4 border-l-[#ff6b35]" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-medium shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {student.name || <span className="italic text-muted-foreground">No name</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTrackColor(student.certificate_goal)}`}>
                          {student.certificate_goal || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <ReadinessBar value={student.readiness} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <span>{timeAgo(student.last_session_date)}</span>
                        {student.last_score !== null && (
                          <span className="ml-1.5 text-xs text-foreground font-medium">
                            ({student.last_score}%)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {student.weakest_area ? (
                          <span className="px-2 py-0.5 rounded text-xs font-mono bg-secondary text-foreground">
                            {student.weakest_area}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            isAtRisk
                              ? "bg-[#ef4444]/10 text-[#ef4444]"
                              : "bg-[#22c55e]/10 text-[#22c55e]"
                          }`}
                        >
                          {isAtRisk ? "Needs Review" : "On Track"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => router.push(`/instructor/${student.id}`)}
                          className="text-xs text-[#1e3a5f] hover:underline font-medium whitespace-nowrap"
                        >
                          View Progress →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No students yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Invite students to start tracking their progress
            </p>
            <button
              onClick={() => router.push("/school/invite?tab=student")}
              className="bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Invite Your First Student
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
