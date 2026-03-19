"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { Send, RotateCcw } from "lucide-react";

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  cert_track: string | null;
  created_at: string;
  inviter_name: string | null;
};

type Instructor = {
  id: string;
  user_id: string;
  name: string;
  email: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SchoolInviteContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"instructor" | "student">(() => {
    const tab = searchParams.get("tab");
    return tab === "instructor" || tab === "student" ? tab : "instructor";
  });
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [assignInstructor, setAssignInstructor] = useState("");
  const [certTrack, setCertTrack] = useState<"PPL" | "IR" | "CPL">("PPL");

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  const loadInvites = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/school/invite?school_id=${sid}`);
      const data = await readJsonResponse<{ invites?: PendingInvite[]; error?: string }>(res);
      if (res.ok) setInvites(data.invites || []);
    } catch {
      // silently fail
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const schoolRes = await fetch("/api/school/mine");
        const schoolData = await readJsonResponse<{ school?: { id: string; name: string; role: string } | null }>(schoolRes);
        const sid = schoolData?.school?.id;
        const role = schoolData?.school?.role;
        if (!sid) return;
        setSchoolId(sid);
        setUserRole(role || null);
        // Instructors can only invite students — force to student tab
        if (role === "instructor") setActiveTab("student");

        // Load instructors and invites in parallel
        const [, instrRes] = await Promise.all([
          loadInvites(sid),
          fetch(`/api/school/members?school_id=${sid}&role=instructor`),
        ]);
        const instrData = await readJsonResponse<{ members?: Instructor[] }>(instrRes);
        setInstructors(instrData.members || []);
      } catch {
        // silently fail
      }
    }
    init();
  }, [loadInvites]);

  async function handleSendInvite() {
    if (!email || !schoolId) return;
    setSendingInvite(true);
    setErrorMessage(null);
    const sentEmail = email;
    try {
      const res = await fetch("/api/school/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          email,
          role: activeTab,
          assign_instructor_id: assignInstructor || null,
          cert_track: activeTab === "student" ? certTrack : null,
          message,
        }),
      });
      const data = await readJsonResponse<{ success?: boolean; inviteUrl?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || "Failed to send invite");
      setEmail("");
      setMessage("");
      setAssignInstructor("");
      let msg = `Invite sent to ${sentEmail}`;
      if (data.inviteUrl) msg += ` — Copy link: ${data.inviteUrl}`;
      showSuccess(msg);
      if (schoolId) loadInvites(schoolId);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleResend(inviteId: string) {
    setResendingId(inviteId);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/school/invite/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      const data = await readJsonResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || "Failed to resend invite");
      showSuccess("Invite resent successfully");
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to resend");
    } finally {
      setResendingId(null);
    }
  }

  const filteredInvites = invites.filter((inv) =>
    activeTab === "instructor" ? inv.role === "instructor" : inv.role === "student"
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Invite Team</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage invitations for your flight school</p>
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

      {/* Tabs — instructors only see student tab */}
      {userRole !== "instructor" && (
        <div className="border-b border-border">
          <div className="flex gap-6">
            {(["instructor", "student"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? "border-[#1e3a5f] text-[#1e3a5f]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Invite {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Invite Form */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold text-foreground">
          Invite {activeTab === "instructor" ? "a Flight Instructor" : "a Student"}
        </h2>

        <div className="space-y-2">
          <label className="text-sm text-foreground">
            {activeTab === "instructor" ? "Instructor" : "Student"} Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full h-10 px-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-foreground">Role</label>
          <span className="inline-block px-3 py-1 rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs font-medium">
            {activeTab === "instructor" ? "Instructor" : "Student"}
          </span>
        </div>

        {activeTab === "student" && (
          <>
            <div className="space-y-2">
              <label className="text-sm text-foreground">Assign to Instructor</label>
              <select
                value={assignInstructor}
                onChange={(e) => setAssignInstructor(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-input-background text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select instructor...</option>
                {instructors.map((inst) => (
                  <option key={inst.user_id} value={inst.user_id}>
                    {inst.name || inst.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-foreground">Certificate Track</label>
              <div className="flex gap-2">
                {(["PPL", "IR", "CPL"] as const).map((track) => (
                  <button
                    key={track}
                    onClick={() => setCertTrack(track)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      certTrack === track ? "bg-[#1e3a5f] text-white" : "bg-secondary text-foreground"
                    }`}
                  >
                    {track}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <label className="text-sm text-foreground">Add a personal note (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Welcome to our flight school..."
            className="w-full h-20 px-3 py-2 rounded-lg border border-border bg-input-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          />
        </div>

        <button
          onClick={handleSendInvite}
          disabled={!email || sendingInvite || !schoolId}
          className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          {sendingInvite ? "Sending..." : "Send Invite"}
        </button>
      </div>

      {/* Pending Invites */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-foreground font-medium">Pending Invites</h3>
        </div>

        {loadingInvites ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filteredInvites.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredInvites.map((invite) => (
              <div key={invite.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span className="text-sm text-foreground truncate">{invite.email}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-[#1e3a5f]/10 text-[#1e3a5f] shrink-0">
                    {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                  </span>
                  {invite.cert_track && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground shrink-0">
                      {invite.cert_track}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDate(invite.created_at)}</span>
                  <button
                    onClick={() => handleResend(invite.id)}
                    disabled={resendingId === invite.id}
                    className="inline-flex items-center gap-1 text-xs text-[#1e3a5f] hover:underline disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {resendingId === invite.id ? "Sending..." : "Resend"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No pending invites</div>
        )}
      </div>
    </div>
  );
}

export default function SchoolInvitePage() {
  return (
    <Suspense>
      <SchoolInviteContent />
    </Suspense>
  );
}
