"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { ArrowLeft, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
  acsAreas: Array<{ acs_task_code: string; mastery: number; attempts: number; passes: number; fails: number }>;
  scoreTrend: Array<{ id: string; started_at: string; score: number | null }>;
  notes: Array<{ id: string; note_text: string; created_at: string }>;
};

type Note = { id: string; note_text: string; created_at: string };

function acsStatus(mastery: number): "pass" | "probe" | "remediate" {
  if (mastery >= 3.5) return "pass";
  if (mastery >= 2) return "probe";
  return "remediate";
}

function formatSessionDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const resultColors: Record<string, string> = {
  PASS: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20",
  PROBE: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
  REMEDIATE: "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20",
  FAIL: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20",
};

export default function StudentDetailPage() {
  const router = useRouter();
  const { studentId } = useParams() as { studentId: string };

  const [data, setData] = useState<StudentData | null>(null);
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
        const json = await readJsonResponse<StudentData & { error?: string }>(res);
        if (!res.ok) throw new Error(json.error || "Failed to load student");
        setData(json);
        setNotes(json.notes || []);
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

  const chartData = (data?.scoreTrend || []).map((s, i) => ({
    session: i + 1,
    score: s.score ?? 0,
  }));

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-64 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-48 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.push("/instructor")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error || "Student not found"}</p>
        </div>
      </div>
    );
  }

  const { student, sessions, acsAreas } = data;

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
            <span className="text-muted-foreground">{sessions.length} sessions completed</span>
          </div>
        </div>
      </div>

      {/* Grade trend chart */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#22c55e]" />
          <h2 className="text-foreground text-lg font-semibold">Grade Trend</h2>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="session"
                stroke="var(--muted-foreground)"
                label={{ value: "Session", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                label={{ value: "Score", angle: -90, position: "insideLeft" }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#ff6b35"
                strokeWidth={2}
                dot={{ fill: "#ff6b35" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">No session data yet</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACS areas */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-foreground mb-3 text-lg font-semibold">ACS Knowledge Areas</h2>
          <p className="text-muted-foreground text-xs mb-4">Color-coded performance across different areas</p>
          {acsAreas.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {acsAreas.map((area) => {
                const status = acsStatus(Number(area.mastery));
                return (
                  <div
                    key={area.acs_task_code}
                    className={`p-3 rounded-lg border text-sm font-medium ${
                      status === "pass"
                        ? "bg-[#22c55e]/10 border-[#22c55e]/20 text-[#22c55e]"
                        : status === "probe"
                        ? "bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24]"
                        : "bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]"
                    }`}
                  >
                    {area.acs_task_code}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No ACS data yet</p>
          )}
        </div>

        {/* Recent sessions */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-foreground mb-4 text-lg font-semibold">Recent Sessions</h2>
          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.slice(0, 5).map((session) => {
                const result = session.overall_grade || session.status?.toUpperCase() || "PROBE";
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-foreground text-sm mb-0.5">{formatSessionDate(session.started_at)}</p>
                      <p className="text-muted-foreground text-xs">
                        Score: {session.score !== null ? `${session.score}%` : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-1 border font-medium text-xs ${resultColors[result] || resultColors.PROBE}`}>
                        {result}
                      </span>
                      <button
                        onClick={() => router.push(`/sessions/${session.id}/debrief`)}
                        className="text-xs text-[#1e3a5f] hover:underline font-medium"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          )}
        </div>
      </div>

      {/* Instructor Notes */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-foreground text-lg font-semibold">Instructor Notes</h2>

        {/* Existing notes feed */}
        {notes.length > 0 && (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg bg-[#fefce8] border border-yellow-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{formatSessionDate(note.created_at)}</p>
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

        {/* New note input */}
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="w-full h-28 px-3 py-2 rounded-lg border border-border bg-input-background resize-none text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          placeholder="Add notes about this student's progress, areas to focus on, or any concerns..."
        />

        {noteSaved && (
          <p className="text-sm text-green-600">Note saved.</p>
        )}
        {noteError && (
          <p className="text-sm text-red-600">{noteError}</p>
        )}

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
