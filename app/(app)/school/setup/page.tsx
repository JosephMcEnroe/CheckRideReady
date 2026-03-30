"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { UserCog, ShieldCheck, Plane, Cloud, BookOpen } from "lucide-react";

const trainingTracks = [
  { id: "PPL", label: "PPL", icon: Plane },
  { id: "Instrument", label: "Instrument", icon: Cloud },
  { id: "Commercial", label: "Commercial", icon: Plane },
  { id: "CFI", label: "CFI", icon: BookOpen },
];

export default function SchoolSetupPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [schoolICAO, setSchoolICAO] = useState("");
  const [role, setRole] = useState<"cfi" | "admin" | null>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/school/mine")
      .then((res) => readJsonResponse<{ school?: { role: string } | null }>(res))
      .then((data) => {
        if (data.school?.role === "admin") {
          // Already an admin — go to school management
          return router.replace("/school/invite");
        } else {
          // No school, or a non-admin member — not allowed here
          return router.replace("/dashboard");
        }
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  function toggleTrack(track: string) {
    setTracks((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]
    );
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/school/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: schoolName, icao_identifier: schoolICAO, role, tracks }),
      });
      const data = await readJsonResponse<{ schoolId?: string; success?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || "Failed to create school");
      router.push("/school/invite");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create school");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[520px]">
        <div className="bg-card rounded-xl border border-border p-8 shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Create Your Flight School</h1>
            <p className="text-muted-foreground text-sm">
              Set up your school to manage instructors and students
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground">School Name</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Rochester Flight Academy"
              className="w-full h-10 px-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground">School ICAO Identifier</label>
            <input
              type="text"
              value={schoolICAO}
              onChange={(e) => setSchoolICAO(e.target.value.toUpperCase())}
              placeholder="e.g. KROC"
              maxLength={4}
              className="w-full h-10 px-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] text-sm uppercase"
            />
            <p className="text-xs text-muted-foreground">Your primary training airport</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground">Your Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole("cfi")}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  role === "cfi" ? "border-[#1e3a5f] bg-[#1e3a5f]/5" : "border-border hover:border-[#1e3a5f]/30"
                }`}
              >
                <UserCog className="h-5 w-5 text-[#1e3a5f] shrink-0" />
                <span className="text-sm text-foreground">Chief Flight Instructor / Owner</span>
              </button>
              <button
                onClick={() => setRole("admin")}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  role === "admin" ? "border-[#1e3a5f] bg-[#1e3a5f]/5" : "border-border hover:border-[#1e3a5f]/30"
                }`}
              >
                <ShieldCheck className="h-5 w-5 text-[#1e3a5f] shrink-0" />
                <span className="text-sm text-foreground">Administrator</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-foreground">Training Tracks</label>
            <div className="grid grid-cols-2 gap-2">
              {trainingTracks.map((track) => (
                <label
                  key={track.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={tracks.includes(track.id)}
                    onChange={() => toggleTrack(track.id)}
                    className="h-4 w-4 rounded border-border text-[#1e3a5f]"
                  />
                  <track.icon className="h-4 w-4 text-[#1e3a5f]" />
                  <span className="text-sm text-foreground">{track.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!schoolName || !schoolICAO || !role || loading}
            className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create School"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            You can invite instructors and students after setup
          </p>
        </div>
      </div>
    </div>
  );
}
