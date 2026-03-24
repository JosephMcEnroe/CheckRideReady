"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { Plus, Search, X } from "lucide-react";

type Student = {
  id: string;
  member_id: string;
  name: string | null;
  email: string;
  certificate_goal: string | null;
  joined_at: string;
  instructor_id: string | null;
  instructor_name: string | null;
  last_session_date: string | null;
  last_result: string | null;
  session_count: number;
  avg_score: number | null;
};

type Instructor = {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
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

function getInitials(name: string | null, email: string) {
  const source = name || email;
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const gradeColors: Record<string, string> = {
  PASS: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20",
  PROBE: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
  REMEDIATE: "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20",
  FAIL: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20",
};

export default function SchoolStudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [instructorSearch, setInstructorSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Remove confirmation
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const schoolRes = await fetch("/api/school/mine");
        const schoolData = await readJsonResponse<{ school?: { id: string; role: string } | null }>(schoolRes);
        const school = schoolData?.school;

        if (!school || school.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setSchoolId(school.id);

        const [studentsRes, instrRes] = await Promise.all([
          fetch("/api/school/admin/students"),
          fetch(`/api/school/members?school_id=${school.id}&role=instructor`),
        ]);

        const [studentsData, instrData] = await Promise.all([
          readJsonResponse<{ students?: Student[]; error?: string }>(studentsRes),
          readJsonResponse<{ members?: Instructor[] }>(instrRes),
        ]);

        if (!studentsRes.ok) throw new Error(studentsData.error || "Failed to load students");
        setStudents(studentsData.students || []);
        setInstructors(instrData.members || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Sort: unassigned first, then by last_session_date desc
  const sortedStudents = [...students].sort((a, b) => {
    if (!a.instructor_id && b.instructor_id) return -1;
    if (a.instructor_id && !b.instructor_id) return 1;
    if (!a.last_session_date && !b.last_session_date) return 0;
    if (!a.last_session_date) return 1;
    if (!b.last_session_date) return -1;
    return new Date(b.last_session_date).getTime() - new Date(a.last_session_date).getTime();
  });

  // Instructor student counts (for modal badge)
  const instructorStudentCount = new Map<string, number>();
  for (const s of students) {
    if (s.instructor_id) {
      instructorStudentCount.set(s.instructor_id, (instructorStudentCount.get(s.instructor_id) || 0) + 1);
    }
  }

  // Stats
  const totalStudents = students.length;
  const assignedCount = students.filter((s) => s.instructor_id !== null).length;
  const unassignedCount = totalStudents - assignedCount;
  const scoredStudents = students.filter((s) => s.avg_score !== null);
  const avgScore =
    scoredStudents.length > 0
      ? Math.round(scoredStudents.reduce((sum, s) => sum + (s.avg_score || 0), 0) / scoredStudents.length)
      : null;

  function openAssignModal(student: Student) {
    setSelectedStudent(student);
    setSelectedInstructorId(student.instructor_id || "");
    setInstructorSearch("");
    setAssignError(null);
    setShowAssignModal(true);
  }

  async function handleConfirmAssign() {
    if (!selectedStudent || !selectedInstructorId || !schoolId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch("/api/school/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          student_id: selectedStudent.id,
          instructor_id: selectedInstructorId,
        }),
      });
      const data = await readJsonResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to assign");

      const instructor = instructors.find((i) => i.user_id === selectedInstructorId);
      const instructorName = instructor?.name || instructor?.email || "Instructor";

      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id
            ? { ...s, instructor_id: selectedInstructorId, instructor_name: instructorName }
            : s
        )
      );
      setSuccessBanner(
        `Successfully assigned ${selectedStudent.name || selectedStudent.email} to ${instructorName}`
      );
      setTimeout(() => setSuccessBanner(null), 5000);
      setShowAssignModal(false);
      setSelectedStudent(null);
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(student: Student) {
    if (!student.member_id) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/school/settings?member_id=${student.member_id}`, { method: "DELETE" });
      const data = await readJsonResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to remove student");
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setRemovingStudentId(null);
      setSuccessBanner(`${student.name || student.email} has been removed from the school`);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setRemoving(false);
    }
  }

  const filteredInstructors = instructors.filter(
    (i) =>
      !instructorSearch ||
      (i.name || i.email).toLowerCase().includes(instructorSearch.toLowerCase())
  );

  const isReassigning = Boolean(selectedStudent?.instructor_id);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 bg-muted rounded w-32" />
            <div className="h-4 bg-muted rounded w-56" />
          </div>
          <div className="h-9 bg-muted rounded w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted border-b border-border last:border-b-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Students</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All students enrolled in your school</p>
        </div>
        <a
          href="/school/invite?tab=student"
          className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Invite Student
        </a>
      </div>

      {/* Banners */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4 text-red-500" />
          </button>
        </div>
      )}
      {successBanner && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-green-800">{successBanner}</p>
          <button onClick={() => setSuccessBanner(null)}>
            <X className="h-4 w-4 text-green-600" />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Students", value: String(totalStudents) },
          { title: "Assigned Students", value: String(assignedCount) },
          { title: "Unassigned Students", value: String(unassignedCount) },
          { title: "Avg Score", value: avgScore !== null ? `${avgScore}%` : "—" },
        ].map((card) => (
          <div key={card.title} className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
            <p className="text-2xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Table or empty state */}
      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <p className="text-lg font-medium text-foreground">No students yet</p>
          <a
            href="/school/invite?tab=student"
            className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite your first student
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Track</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned Instructor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sessions</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Avg Score</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Session</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Result</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {sortedStudents.map((student) => {
                const isUnassigned = !student.instructor_id;
                const isConfirmingRemove = removingStudentId === student.id;
                const initials = getInitials(student.name, student.email);

                return (
                  <Fragment key={student.id}>
                    <tr
                      className={`hover:bg-secondary/30 transition-colors${isUnassigned ? " border-l-2 border-l-[#ff6b35]" : ""}`}
                    >
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-medium shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {student.name || <span className="text-muted-foreground italic">No name</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Track */}
                      <td className="px-4 py-3">
                        {student.certificate_goal ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#1e3a5f]/10 text-[#1e3a5f]">
                            {student.certificate_goal}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Instructor */}
                      <td className="px-4 py-3">
                        {student.instructor_name ? (
                          <span className="text-foreground">{student.instructor_name}</span>
                        ) : (
                          <span className="text-[#ff6b35] font-medium">Unassigned</span>
                        )}
                      </td>

                      {/* Sessions */}
                      <td className="px-4 py-3 text-foreground">{student.session_count}</td>

                      {/* Avg Score */}
                      <td className="px-4 py-3">
                        {student.avg_score !== null ? (
                          `${student.avg_score}%`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Last Session */}
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(student.last_session_date)}</td>

                      {/* Last Result */}
                      <td className="px-4 py-3">
                        {student.last_result ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 border text-xs font-medium ${
                              gradeColors[student.last_result] || gradeColors.PROBE
                            }`}
                          >
                            {student.last_result}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAssignModal(student)}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
                          >
                            {isUnassigned ? "Assign" : "Reassign"}
                          </button>
                          <button
                            onClick={() =>
                              setRemovingStudentId(isConfirmingRemove ? null : student.id)
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline remove confirmation */}
                    {isConfirmingRemove && (
                      <tr key={`${student.id}-confirm`} className="bg-red-50/50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <p className="text-foreground">
                              Are you sure you want to remove{" "}
                              <span className="font-medium">{student.name || student.email}</span> from the
                              school?
                            </p>
                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                onClick={() => handleRemove(student)}
                                disabled={removing}
                                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                {removing ? "Removing..." : "Yes, Remove"}
                              </button>
                              <button
                                onClick={() => setRemovingStudentId(null)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign / Reassign Modal */}
      {showAssignModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            aria-label="Close modal"
            className="absolute inset-0 bg-black/50 border-none p-0 cursor-default"
            onClick={() => setShowAssignModal(false)}
          />
          <div className="relative bg-card rounded-xl border border-border shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {isReassigning ? "Reassign Instructor" : "Assign Instructor"}
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Student info */}
            <div>
              <p className="text-sm font-medium text-foreground">
                {selectedStudent.name || selectedStudent.email}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedStudent.instructor_name
                  ? `Current: ${selectedStudent.instructor_name}`
                  : "Currently unassigned"}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search instructors..."
                value={instructorSearch}
                onChange={(e) => setInstructorSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
            </div>

            {/* Instructor list */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredInstructors.length > 0 ? (
                filteredInstructors.map((inst) => {
                  const count = instructorStudentCount.get(inst.user_id) || 0;
                  const initials = getInitials(inst.name, inst.email);
                  return (
                    <label
                      key={inst.user_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedInstructorId === inst.user_id
                          ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                          : "border-border hover:border-[#1e3a5f]/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="instructor"
                        value={inst.user_id}
                        checked={selectedInstructorId === inst.user_id}
                        onChange={() => setSelectedInstructorId(inst.user_id)}
                        className="accent-[#1e3a5f]"
                      />
                      <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-medium shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {inst.name || inst.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {count} student{count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {instructors.length === 0
                    ? "No instructors available. Invite one first."
                    : "No instructors match your search."}
                </p>
              )}
            </div>

            {/* Modal error */}
            {assignError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700">{assignError}</p>
              </div>
            )}

            {/* Modal actions */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleConfirmAssign}
                disabled={!selectedInstructorId || assigning || instructors.length === 0}
                className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning
                  ? "Saving..."
                  : isReassigning
                  ? "Confirm Reassignment"
                  : "Confirm Assignment"}
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
