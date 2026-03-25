"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { readJsonResponse } from "@/lib/http";

export type WeakArea = {
  acs_task_code: string;
  acs_area: string;
  fail_count: number;
};

type Props = {
  weakAreas: WeakArea[];
};

export function DrillWeakAreas({ weakAreas }: Props) {
  const router = useRouter();
  const [drillLoading, setDrillLoading] = useState<string | null>(null);

  const startDrill = async (acsTask: string, acsArea: string) => {
    setDrillLoading(acsTask);
    try {
      const res = await fetch("/api/sessions/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acs_task_code: acsTask, acs_area: acsArea }),
      });
      const data = await readJsonResponse<{ sessionId?: string; error?: string }>(res);
      if (data.sessionId) {
        router.push(`/sessions/${data.sessionId}/drill`);
      }
    } finally {
      setDrillLoading(null);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Drill Your Weak Areas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Launch a focused 10-question drill on topics where you struggled
        </p>
      </div>

      {weakAreas.length === 0 ? (
        <div className="p-4 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/20">
          <p className="text-[#22c55e] font-medium">No weak areas — great session!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start a new session to keep building your mastery.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {weakAreas.map((area) => (
            <div
              key={area.acs_task_code}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
            >
              <div>
                <p className="font-medium text-foreground">{area.acs_area}</p>
                <p className="text-sm text-muted-foreground">{area.fail_count} questions need work</p>
              </div>
              <button
                onClick={() => startDrill(area.acs_task_code, area.acs_area)}
                disabled={drillLoading === area.acs_task_code}
                className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {drillLoading === area.acs_task_code ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Drill This
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
