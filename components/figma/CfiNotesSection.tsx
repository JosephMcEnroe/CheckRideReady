"use client";

import { useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/http";

type CfiNote = {
  id: string;
  note_text: string;
  created_at: string;
  instructor_name: string | null;
};

type Props = {
  sessionId: string;
  studentId: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CfiNotesSection({ sessionId, studentId }: Props) {
  const [notes, setNotes] = useState<CfiNote[]>([]);
  const [isInstructor, setIsInstructor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [notesRes, assignRes] = await Promise.all([
          fetch(`/api/instructor/notes?session_id=${sessionId}`),
          fetch(`/api/instructor/students/${studentId}`).catch(() => null),
        ]);

        const notesData = await readJsonResponse<{ notes?: CfiNote[]; error?: string }>(notesRes);
        setNotes(notesData.notes || []);

        // If assignRes succeeded with 200, this viewer is the instructor
        if (assignRes && assignRes.ok) {
          setIsInstructor(true);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId, studentId]);

  async function handleSave() {
    if (!newNote.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/instructor/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, session_id: sessionId, note_text: newNote }),
      });
      const data = await readJsonResponse<{ success?: boolean; noteId?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to save note");
      const added: CfiNote = {
        id: data.noteId!,
        note_text: newNote,
        created_at: new Date().toISOString(),
        instructor_name: "You",
      };
      setNotes((prev) => [added, ...prev]);
      setNewNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Instructor Notes</h2>

      {notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-[#fefce8] border border-yellow-200 p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {note.instructor_name && <span className="font-medium text-foreground">{note.instructor_name}</span>}
                <span>·</span>
                <span>{formatDate(note.created_at)}</span>
              </div>
              <p className="text-sm text-foreground">{note.note_text}</p>
            </div>
          ))}
        </div>
      ) : isInstructor ? null : (
        <p className="text-sm text-muted-foreground">Your instructor hasn&apos;t left feedback yet.</p>
      )}

      {isInstructor && (
        <div className="space-y-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note for this session..."
            className="w-full h-24 px-3 py-2 rounded-lg border border-border bg-input-background resize-none text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          />
          {saved && <p className="text-sm text-green-600">Note saved.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !newNote.trim()}
              className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
