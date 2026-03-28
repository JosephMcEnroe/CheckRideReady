"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Filter } from "lucide-react";
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

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDuration(seconds: number | null) {
  if (seconds === null || Number.isNaN(seconds)) return "-";
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return `${hrs}h ${rem}m`;
  return `${mins} min`;
}

const PAGE_SIZE = 20;

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ResultCode>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/list?limit=${PAGE_SIZE}&offset=0`);
        const json = await readJsonResponse<{ sessions?: SessionListItem[]; total?: number; error?: string }>(res);
        if (!res.ok) throw new Error(json.error || "Failed to load sessions");
        setSessions(json.sessions || []);
        setTotal(json.total ?? 0);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/sessions/list?limit=${PAGE_SIZE}&offset=${sessions.length}`);
      const json = await readJsonResponse<{ sessions?: SessionListItem[]; total?: number; error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Failed to load more");
      setSessions((prev) => [...prev, ...(json.sessions || [])]);
      setTotal(json.total ?? total);
    } catch {
      // silently fail — existing sessions still visible
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredSessions = useMemo(() => {
    if (filter === "all") return sessions;
    return sessions.filter((s) => s.last_result === filter);
  }, [sessions, filter]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">Session History</h1>
          <p className="text-muted-foreground">Review your past oral exam sessions and track progress</p>
        </div>
        <Link
          href="/sessions/new"
          className="inline-flex items-center justify-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md"
        >
          Start New Session
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter by result:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "PASS", "PROBE", "REMEDIATE", "FAIL"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {status === "all" ? "All" : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-40 bg-muted rounded" />
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </div>
                  <div className="flex gap-6">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-4 w-20 bg-muted rounded" />
                    <div className="h-4 w-20 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-5 w-5 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">{error}</div>}

      {!loading && !error && (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const href = session.last_result ? `/sessions/${session.id}/debrief` : `/sessions/${session.id}`;
            return (
              <Link
                key={session.id}
                href={href}
                className="block bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md hover:border-[#1e3a5f]/30 transition-all group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-foreground">{session.topic || "Untitled Session"}</h3>
                      {session.last_result ? (
                        <StatusBadge status={session.last_result} />
                      ) : (
                        <StatusBadge status="IN_PROGRESS" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Date:</span>
                        <span>{formatDateTime(session.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Score:</span>
                        <span>{session.score === null ? "-" : `${session.score}%`}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Duration:</span>
                        <span>{formatDuration(session.duration_seconds)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Questions:</span>
                        <span>{session.question_count ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[#1e3a5f] transition-colors" />
                </div>
              </Link>
            );
          })}

          {filteredSessions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No sessions found with this filter.</p>
            </div>
          )}

          {filter === "all" && sessions.length < total && (
            <div className="text-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : `Load more (${total - sessions.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
