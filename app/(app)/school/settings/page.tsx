"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { Trash2, UserPlus } from "lucide-react";

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "instructor" | "student";
  created_at: string;
  name: string | null;
  email: string;
};

type School = {
  id: string;
  name: string;
  icao_identifier: string | null;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const roleColors: Record<string, string> = {
  admin: "bg-[#1e3a5f]/10 text-[#1e3a5f]",
  instructor: "bg-[#ff6b35]/10 text-[#ff6b35]",
  student: "bg-[#22c55e]/10 text-[#22c55e]",
};

export default function SchoolSettingsPage() {
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  function showError(msg: string) {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const schoolRes = await fetch("/api/school/mine");
        const schoolData = await readJsonResponse<{ school?: { role: string } | null }>(schoolRes);
        if (!schoolData?.school || schoolData.school.role !== "admin") {
          router.replace("/dashboard");
          return;
        }

        const res = await fetch("/api/school/settings");
        const data = await readJsonResponse<{
          school?: School;
          members?: Member[];
          currentUserId?: string;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        setSchool(data.school || null);
        setMembers(data.members || []);
        setCurrentUserId(data.currentUserId || null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleRoleChange(memberId: string, newRole: string) {
    setUpdatingId(memberId);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/school/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, role: newRole }),
      });
      const data = await readJsonResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole as Member["role"] } : m))
      );
      showSuccess("Role updated successfully");
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the school?`)) return;
    setRemovingId(memberId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/school/settings?member_id=${memberId}`, { method: "DELETE" });
      const data = await readJsonResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      showSuccess(`${memberName} removed from school`);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
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

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Organization Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your flight school members and roles</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/school/invite?tab=student")}
            className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Student
          </button>
          <button
            onClick={() => router.push("/school/invite?tab=instructor")}
            className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Instructor
          </button>
        </div>
      </div>

      {/* Banners */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* School info card */}
      {school && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{school.name}</h2>
              {school.icao_identifier && (
                <p className="text-sm text-muted-foreground">ICAO: {school.icao_identifier}</p>
              )}
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#22c55e]/10 text-[#22c55e]">
              Active
            </span>
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Members</h2>
          <span className="text-sm text-muted-foreground">{members.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr className="text-left">
                <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Name</th>
                <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Email</th>
                <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Role</th>
                <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Joined</th>
                <th className="py-2.5 px-4 text-muted-foreground text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const isAdmin = member.role === "admin";
                const canModify = !isCurrentUser && !isAdmin;
                return (
                  <tr key={member.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      {member.name || "—"}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{member.email}</td>
                    <td className="py-3 px-4">
                      {canModify ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          disabled={updatingId === member.id}
                          className="text-xs rounded-md border border-border bg-input-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] disabled:opacity-50"
                        >
                          <option value="instructor">Instructor</option>
                          <option value="student">Student</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            roleColors[member.role] || ""
                          }`}
                        >
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleRemove(member.id, member.name || member.email)}
                        disabled={!canModify || removingId === member.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-[#ef4444] hover:bg-[#ef4444]/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!canModify ? "Cannot remove this member" : "Remove member"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No members yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
