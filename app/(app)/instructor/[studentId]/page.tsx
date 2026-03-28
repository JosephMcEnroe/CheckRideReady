"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { ArrowLeft, Clock, MessageSquare, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/figma/StatusBadge";

type StudentData = {
  student: { id: string; name: string | null; email: string; certificate_goal: string | null };
  sessions: Array<{
    id: string;
    mode: string;
    status: string;
    overall_grade: string | null;
    started_at: string;
    ended_at: string | null;
    score: number | null;
  }>;
  notes: Array<{ id: string; note_text: string; created_at: string }>;
};

type ACSArea = {
  code: string;
  name: string;
  masteryPct: number;
  attempts: number;
  passes: number;
  fails: number;
  status: "Strong" | "Developing" | "Needs Work" | "Not Started";
};

type ProgressData = {
  readiness: number;
  stats: {
    totalSessions: number;
    questionsAnswered: number;
    passRate: number;
    weakestArea: string;
  };
  acsAreas: ACSArea[];
  recentSessions: Array<{
    id: string;
    mode: string;
    topic: string;
    score: number | null;
    result: string;
    date: string;
  }>;
};

type Note = { id: string; note_text: string; created_at: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

export default function StudentDetailPage() {
  const router = useRouter();
  const { studentId } = useParams() as { studentId: string };

  const [data, setData] = useState<StudentData | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/instructor/students/${studentId}`);
        const json = await readJsonResponse<StudentData & ProgressData & { error?: string }>(res);
        if (!res.ok) throw new Error(json.error || "Failed to load student");
        setData(json);
        setNotes(json.notes || []);
        setProgressData({
          readiness: json.readiness,
          stats: json.stats,
          acsAreas: json.acsAreas,
          recentSessions: json.recentSessions,
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  async function handleSaveNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch("/api/instructor/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, note_text: newNote }),
      });
      const json = await readJsonResponse<{ success?: boolean; noteId?: string; error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Failed to save note");
      const savedNote: Note = {
        id: json.noteId!,
        note_text: newNote,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [savedNote, ...prev]);
      setNewNote("");
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch (e: unknown) {
      setNoteError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await fetch(`/api/instructor/notes?note_id=${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-lg" />)}
        </div>
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/instructor")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error || "Student not found"}</p>
        </div>
      </div>
    );
  }

  const { student } = data;
  const totalSessions = progressData?.stats.totalSessions ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/instructor")}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            {student.name || student.email}
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{student.certificate_goal || "No track set"}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{totalSessions} sessions completed</span>
          </div>
        </div>
        {progressData && (
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${getReadinessColor(progressData.readiness)}`}
          >
            {progressData.readiness}% Ready
          </div>
        )}
      </div>

      {/* Stats row */}
      {progressData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Sessions", value: progressData.stats.totalSessions, icon: Clock, color: "text-[#1e3a5f]" },
            { label: "Questions Answered", value: progressData.stats.questionsAnswered, icon: MessageSquare, color: "text-[#1e3a5f]" },
            { label: "Overall Pass Rate", value: `${progressData.stats.passRate}%`, icon: TrendingUp, color: "text-[#22c55e]" },
            { label: "Weakest Area", value: progressData.stats.weakestArea, icon: AlertTriangle, color: "text-[#ff6b35]" },
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
      )}

      {/* ACS Knowledge Areas */}
      <div>
        <h2 className="text-foreground mb-1 text-lg font-semibold">ACS Knowledge Areas</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Color coded by mastery level across all sessions
        </p>
        {!progressData || progressData.acsAreas.length === 0 ? (
          <p className="text-muted-foreground text-sm">No ACS data yet. Student needs to complete sessions.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {progressData.acsAreas.map((area) => {
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

      {/* Recent Sessions */}
      <div>
        <h2 className="text-foreground mb-4 text-lg font-semibold">Recent Sessions</h2>
        {!progressData || progressData.recentSessions.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="divide-y divide-border">
              {progressData.recentSessions.map((session, index) => (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        Session #{progressData.recentSessions.length - index}
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
        )}
      </div>

      {/* Instructor Notes */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-foreground text-lg font-semibold">Instructor Notes</h2>

        {notes.length > 0 && (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg bg-[#fefce8] border border-yellow-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{formatDate(note.created_at)}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-foreground">{note.note_text}</p>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="w-full h-28 px-3 py-2 rounded-lg border border-border bg-input-background resize-none text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          placeholder="Add notes about this student's progress, areas to focus on, or any concerns..."
        />

        {noteSaved && <p className="text-sm text-green-600">Note saved.</p>}
        {noteError && <p className="text-sm text-red-600">{noteError}</p>}

        <div className="flex justify-end">
          <button
            onClick={handleSaveNote}
            disabled={savingNote || !newNote.trim()}
            className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingNote ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
