"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { AlertTriangle, Calendar, Plus, TrendingUp, Users } from "lucide-react";

type Student = {
  id: string;
  name: string | null;
  email: string;
  certificate_goal: string | null;
  last_session_date: string | null;
  last_result: string | null;
  last_score: number | null;
  session_count: number;
  weakest_area: string | null;
};

type Stats = {
  totalStudents: number;
  sessionsThisWeek: number;
  atRiskStudents: number;
  passRate: number;
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

function studentStatus(lastResult: string | null): "on-track" | "needs-review" {
  return lastResult === "FAIL" || lastResult === "REMEDIATE" ? "needs-review" : "on-track";
}

export default function InstructorDashboardPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [studentsRes, statsRes] = await Promise.all([
          fetch("/api/instructor/students"),
          fetch("/api/instructor/stats"),
        ]);
        const studentsData = await readJsonResponse<{ students?: Student[]; error?: string }>(studentsRes);
        const statsData = await readJsonResponse<Stats & { error?: string }>(statsRes);
        if (!studentsRes.ok) throw new Error(studentsData.error || "Failed to load students");
        if (!statsRes.ok) throw new Error(statsData.error || "Failed to load stats");
        setStudents(studentsData.students || []);
        setStats(statsData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const metrics = [
    { title: "Active Students", value: stats ? String(stats.totalStudents) : "—", icon: Users },
    { title: "Sessions This Week", value: stats ? String(stats.sessionsThisWeek) : "—", icon: Calendar },
    { title: "At-Risk Students", value: stats ? String(stats.atRiskStudents) : "—", icon: AlertTriangle },
    { title: "Overall Pass Rate", value: stats ? `${stats.passRate}%` : "—", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Instructor Dashboard</h1>
          <p className="text-muted-foreground text-sm">Monitor student progress and identify areas needing attention</p>
        </div>
        <button
          onClick={() => router.push("/school/invite")}
          className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Invite Student
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.title} className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{metric.title}</span>
              <div className="h-8 w-8 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <metric.icon className="h-4 w-4 text-[#1e3a5f]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Students table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Your Students</h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-1/5" />
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-20" />
              </div>
            ))}
          </div>
        ) : students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr className="text-left">
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Name</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Track</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Last Session</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Weakest Area</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Status</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((student) => {
                  const status = studentStatus(student.last_result);
                  return (
                    <tr
                      key={student.id}
                      onClick={() => router.push(`/instructor/${student.id}`)}
                      className="hover:bg-secondary/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        {student.name || student.email}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#1e3a5f]/10 text-[#1e3a5f] font-medium">
                          {student.certificate_goal || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {timeAgo(student.last_session_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {student.weakest_area || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            status === "on-track"
                              ? "bg-[#22c55e]/10 text-[#22c55e]"
                              : "bg-[#ef4444]/10 text-[#ef4444]"
                          }`}
                        >
                          {status === "on-track" ? "On Track" : "Needs Review"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[#1e3a5f] font-medium">View →</td>
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
            <p className="text-sm text-muted-foreground mt-1 mb-4">Invite students to start tracking their progress</p>
            <button
              onClick={() => router.push("/school/invite")}
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
