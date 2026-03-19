"use client";

import { useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/http";
import { Check, Copy, Share2 } from "lucide-react";

type Props = {
  sessionId: string;
};

export function ShareDebriefButton({ sessionId }: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [showShareCopied, setShowShareCopied] = useState(false);

  // Check if share token already exists
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch(`/api/sessions/share?session_id=${sessionId}`);
        const data = await readJsonResponse<{ exists?: boolean; shareUrl?: string }>(res);
        if (data.exists && data.shareUrl) {
          setShareUrl(data.shareUrl);
        }
      } catch {
        // silently fail
      }
    }
    checkExisting();
  }, [sessionId]);

  async function handleShare() {
    setLoadingShare(true);
    try {
      const res = await fetch("/api/sessions/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await readJsonResponse<{ shareUrl?: string; error?: string }>(res);
      if (res.ok && data.shareUrl) {
        setShareUrl(data.shareUrl);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingShare(false);
    }
  }

  function handleCopyShare() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 2000);
  }

  if (!shareUrl) {
    return (
      <button
        onClick={handleShare}
        disabled={loadingShare}
        className="inline-flex items-center gap-2 border border-border bg-card hover:bg-secondary text-foreground px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Share2 className="h-4 w-4" />
        {loadingShare ? "Generating link..." : "Share Debrief"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
      <p className="text-xs text-blue-700 truncate max-w-[220px] sm:max-w-xs">{shareUrl}</p>
      <button
        onClick={handleCopyShare}
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
      >
        {showShareCopied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy Link
          </>
        )}
      </button>
    </div>
  );
}
