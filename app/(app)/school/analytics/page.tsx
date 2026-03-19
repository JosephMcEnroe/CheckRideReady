"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { Award, Calendar, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "month" | "3months" | "all";

type AnalyticsData = {
  metrics: {
    totalSessions: number;
    passRate: number;
    avgScore: number;
    checkrideReady: number;
  };
  weakAreas: Array<{ code: string; failRate: number; total: number }>;
  scoreDistribution: Array<{ name: string; count: number; color: string }>;
  instructorPerformance: Array<{
    id: string;
    name: string;
    studentCount: number;
    sessionCount: number;
    avgScore: number;
    passRate: number;
    lastActive: string | null;
  }>;
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

function indicatorColor(failRate: number) {
  if (failRate >= 30) return "bg-[#ef4444]";
  if (failRate >= 15) return "bg-[#fbbf24]";
  return "bg-[#22c55e]";
}

export default function SchoolAnalyticsPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<Range>("month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const res = await fetch("/api/school/mine");
      const d = await readJsonResponse<{ school?: { role: string } | null }>(res);
      if (!d?.school || d.school.role !== "admin") {
        router.replace("/dashboard");
        return false;
      }
      return true;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const authed = await checkAuth();
        if (!authed) return;
        const res = await fetch(`/api/school/analytics?range=${dateRange}`);
        const json = await readJsonResponse<AnalyticsData & { error?: string }>(res);
        if (!res.ok) throw new Error(json.error || "Failed to load analytics");
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateRange, router]);

  const metrics = [
    { title: "Total Sessions", value: data ? String(data.metrics.totalSessions) : "—", icon: Calendar },
    { title: "Overall Pass Rate", value: data ? `${data.metrics.passRate}%` : "—", icon: TrendingUp },
    { title: "Avg Score", value: data ? `${data.metrics.avgScore}%` : "—", icon: Award },
    { title: "Checkride Ready", value: data ? String(data.metrics.checkrideReady) : "—", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">School Analytics</h1>
          <p className="text-muted-foreground text-sm">Performance insights across your flight school</p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {([
            { key: "month", label: "This Month" },
            { key: "3months", label: "Last 3 Months" },
            { key: "all", label: "All Time" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDateRange(opt.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dateRange === opt.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.title} className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{m.title}</span>
                <div className="h-8 w-8 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <m.icon className="h-4 w-4 text-[#1e3a5f]" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Two-column: Weak Areas + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACS Weak Areas */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">ACS Weak Areas</h2>
            <p className="text-sm text-muted-foreground">Where Students Struggle Most</p>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-muted rounded-lg" />)}
            </div>
          ) : data && data.weakAreas.length > 0 ? (
            <div className="space-y-2">
              {data.weakAreas.map((area, i) => {
                const color = indicatorColor(area.failRate);
                return (
                  <div
                    key={area.code}
                    className={`flex items-center gap-3 p-3 rounded-lg ${i < 3 ? "bg-[#ef4444]/5" : ""}`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">{area.code}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-secondary rounded-full">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${Math.min(area.failRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{area.failRate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          )}
        </div>

        {/* Score Distribution */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Score Distribution</h2>
          {loading ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : data && data.scoreDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.scoreDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-20">No session data yet</p>
          )}
        </div>
      </div>

      {/* Instructor Performance Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-foreground text-lg font-semibold">Instructor Performance</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted rounded" />)}
          </div>
        ) : data && data.instructorPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr className="text-left">
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Instructor</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Students</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Sessions</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Avg Score</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Pass Rate</th>
                  <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {data.instructorPerformance.map((inst) => (
                  <tr key={inst.id} className="border-b border-border last:border-0">
                    <td className="py-3 px-4 text-foreground text-sm font-medium">{inst.name}</td>
                    <td className="py-3 px-4 text-foreground text-sm">{inst.studentCount}</td>
                    <td className="py-3 px-4 text-foreground text-sm">{inst.sessionCount}</td>
                    <td className="py-3 px-4 text-foreground text-sm">{inst.avgScore}%</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          inst.passRate >= 85
                            ? "bg-[#22c55e]/10 text-[#22c55e]"
                            : inst.passRate >= 70
                            ? "bg-[#fbbf24]/10 text-[#fbbf24]"
                            : "bg-[#ef4444]/10 text-[#ef4444]"
                        }`}
                      >
                        {inst.passRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">{timeAgo(inst.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No instructor data yet
          </div>
        )}
      </div>
    </div>
  );
}
