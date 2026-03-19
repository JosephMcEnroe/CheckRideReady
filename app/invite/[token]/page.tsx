"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { Plane } from "lucide-react";
import Link from "next/link";

type InvitePreview =
  | { valid: true; schoolName: string; role: string; inviterName: string | null; email: string }
  | { valid: false; reason: string };

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/school/invite/accept?token=${token}`);
        const data = await readJsonResponse<InvitePreview>(res);
        setPreview(data);
      } catch {
        setPreview({ valid: false, reason: "Failed to load invite details" });
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/school/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await readJsonResponse<{
        success?: boolean;
        requiresAuth?: boolean;
        token?: string;
        error?: string;
      }>(res);

      if (data.requiresAuth) {
        localStorage.setItem("pending_invite_token", token);
        router.push("/login");
        return;
      }

      if (!res.ok) throw new Error(data.error || "Failed to accept invite");
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to accept invite");
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e3a5f]">
          <Plane className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-semibold text-[#1e3a5f]">CheckRideReady</span>
      </div>

      {loadingPreview ? (
        <div className="w-full max-w-md bg-card rounded-xl border border-border p-8 shadow-sm text-center">
          <p className="text-sm text-muted-foreground">Loading invite details...</p>
        </div>
      ) : !preview || !preview.valid ? (
        <div className="w-full max-w-md bg-card rounded-xl border border-border p-8 shadow-sm text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <span className="text-red-600 text-xl">✕</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Invite Invalid</h2>
          <p className="text-sm text-muted-foreground">
            {(preview as { valid: false; reason: string } | null)?.reason ||
              "This invite link is invalid or has expired."}
          </p>
          <Link href="/" className="text-sm text-[#1e3a5f] hover:underline">
            Back to homepage
          </Link>
        </div>
      ) : (
        <div className="w-full max-w-md bg-card rounded-xl border border-border p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[#1e3a5f]">{preview.schoolName}</h2>
            <p className="text-muted-foreground">
              You&apos;ve been invited to join{" "}
              <span className="font-medium text-foreground">{preview.schoolName}</span> as a{" "}
              <span className="font-medium text-foreground capitalize">{preview.role}</span>
            </p>
            {preview.inviterName && (
              <p className="text-sm text-muted-foreground">Invited by {preview.inviterName}</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-3 rounded-xl font-semibold text-white bg-[#1e3a5f] hover:bg-[#2d5a8f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {accepting ? "Accepting..." : "Accept Invitation"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            You&apos;ll need to sign in or create an account to accept
          </p>
        </div>
      )}
    </div>
  );
}
