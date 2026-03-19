"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { Calendar, CheckCircle2, Plus, TrendingUp, UserCheck, Users, X } from "lucide-react";

type Student = {
  id: string;
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

type Stats = {
  totalStudents: number;
  totalInstructors: number;
  sessionsThisWeek: number;
  avgScore: number;
};

type ActivityItem = {
  id: string;
  mode: string;
  overall_grade: string;
  started_at: string;
  student_name: string | null;
  score: number | null;
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

function formatJoinDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const gradeColors: Record<string, string> = {
  PASS: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20",
  PROBE: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20",
  REMEDIATE: "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20",
  FAIL: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20",
};

export default function SchoolStudentsPage() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Check auth + get school
        const schoolRes = await fetch("/api/school/mine");
        const schoolData = await readJsonResponse<{ school?: { id: string; role: string } | null }>(schoolRes);
        const school = schoolData?.school;

        if (!school || school.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setSchoolId(school.id);

        const [statsRes, studentsRes, activityRes, instrRes] = await Promise.all([
          fetch("/api/school/admin/stats"),
          fetch("/api/school/admin/students"),
          fetch("/api/school/admin/activity"),
          fetch(`/api/school/members?school_id=${school.id}&role=instructor`),
        ]);

        const [statsData, studentsData, activityData, instrData] = await Promise.all([
          readJsonResponse<Stats & { error?: string }>(statsRes),
          readJsonResponse<{ students?: Student[]; error?: string }>(studentsRes),
          readJsonResponse<{ activity?: ActivityItem[]; error?: string }>(activityRes),
          readJsonResponse<{ members?: Instructor[] }>(instrRes),
        ]);

        if (!statsRes.ok) throw new Error(statsData.error || "Failed to load stats");
        if (!studentsRes.ok) throw new Error(studentsData.error || "Failed to load students");

        setStats(statsData);
        setStudents(studentsData.students || []);
        setActivity(activityData.activity || []);
        setInstructors(instrData.members || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const assignedStudents = students.filter((s) => s.instructor_id !== null);
  const unassignedStudents = students.filter((s) => s.instructor_id === null);

  // Build instructor load from assigned students
  const instructorStats = new Map<string, { id: string; name: string; studentCount: number; totalScore: number; scoredCount: number }>();
  for (const s of assignedStudents) {
    if (!s.instructor_id) continue;
    const existing = instructorStats.get(s.instructor_id) || {
      id: s.instructor_id,
      name: s.instructor_name || "Unknown",
      studentCount: 0,
      totalScore: 0,
      scoredCount: 0,
    };
    existing.studentCount++;
    if (s.avg_score !== null) {
      existing.totalScore += s.avg_score;
      existing.scoredCount++;
    }
    instructorStats.set(s.instructor_id, existing);
  }
  const instructorList = [...instructorStats.values()].map((i) => ({
    ...i,
    avgScore: i.scoredCount > 0 ? Math.round(i.totalScore / i.scoredCount) : null,
  }));

  function openAssignModal(student: Student) {
    setSelectedStudent(student);
    setSelectedInstructorId("");
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
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id
            ? { ...s, instructor_id: selectedInstructorId, instructor_name: instructor?.name || instructor?.email || null }
            : s
        )
      );
      setSuccessBanner(`${selectedStudent.name || selectedStudent.email} assigned successfully`);
      setTimeout(() => setSuccessBanner(null), 4000);
      setShowAssignModal(false);
      setSelectedStudent(null);
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setAssigning(false);
    }
  }

  const metrics = [
    { title: "Total Students", value: stats ? String(stats.totalStudents) : "—", icon: Users },
    { title: "Total Instructors", value: stats ? String(stats.totalInstructors) : "—", icon: UserCheck },
    { title: "Sessions This Week", value: stats ? String(stats.sessionsThisWeek) : "—", icon: Calendar },
    { title: "School Avg Score", value: stats ? `${stats.avgScore}%` : "—", icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">School Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your flight school</p>
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

      {successBanner && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-800">{successBanner}</p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Two-column: Instructors + Unassigned */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instructors */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Instructors</h2>
          <div className="space-y-3">
            {instructorList.length > 0 ? (
              instructorList.map((inst) => {
                const initials = inst.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const maxStudents = 10;
                return (
                  <div key={inst.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="w-9 h-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-medium shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{inst.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {inst.studentCount}/{maxStudents} students
                        </span>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full max-w-[80px]">
                          <div
                            className={`h-full rounded-full ${inst.studentCount > 8 ? "bg-[#ff6b35]" : "bg-[#1e3a5f]"}`}
                            style={{ width: `${Math.min((inst.studentCount / maxStudents) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {inst.avgScore !== null && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{inst.avgScore}%</p>
                        <p className="text-xs text-muted-foreground">avg score</p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No instructors yet</p>
            )}
            <button
              onClick={() => router.push("/school/invite?tab=instructor")}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#1e3a5f]/30 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Add Instructor</span>
            </button>
          </div>
        </div>

        {/* Unassigned students */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Unassigned Students</h2>
          {unassignedStudents.length > 0 ? (
            <div className="space-y-3">
              {unassignedStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{student.name || student.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">Joined {formatJoinDate(student.joined_at)}</span>
                      {student.certificate_goal && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                          {student.certificate_goal}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openAssignModal(student)}
                    className="bg-[#ff6b35] hover:bg-[#ff5722] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    Assign Instructor
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-[#22c55e]/5 text-[#22c55e]">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">All students are assigned</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        {activity.length > 0 ? (
          <div className="divide-y divide-border">
            {activity.map((item) => {
              const grade = item.overall_grade || "PROBE";
              const studentInitial = (item.student_name || "?").charAt(0).toUpperCase();
              const action = `completed a ${item.mode} session${item.score !== null ? ` — ${item.score}%` : ""}`;
              return (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs shrink-0">
                      {studentInitial}
                    </div>
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{item.student_name || "Unknown"}</span> {action}
                      </p>
                      <p className="text-xs text-muted-foreground">{timeAgo(item.started_at)}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-md px-2.5 py-1 border font-medium text-xs ${
                      gradeColors[grade] || gradeColors.PROBE
                    }`}
                  >
                    {grade}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No session activity yet</p>
        )}
      </div>

      {/* Assign Instructor Modal */}
      {showAssignModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            aria-label="Close modal"
            className="absolute inset-0 bg-black/50 border-none p-0 cursor-default"
            onClick={() => setShowAssignModal(false)}
          />
          <div className="relative bg-card rounded-xl border border-border shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Assign Instructor</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Assigning instructor for{" "}
              <span className="font-medium text-foreground">
                {selectedStudent.name || selectedStudent.email}
              </span>
            </p>

            <div className="space-y-2">
              {instructors.length > 0 ? (
                instructors.map((inst) => {
                  const count = instructorStats.get(inst.user_id)?.studentCount || 0;
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
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{inst.name || inst.email}</p>
                        <p className="text-xs text-muted-foreground">{count} student{count !== 1 ? "s" : ""}</p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No instructors available. Invite one first.</p>
              )}
            </div>

            {assignError && (
              <p className="text-sm text-red-600">{assignError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={!selectedInstructorId || assigning || instructors.length === 0}
                className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
