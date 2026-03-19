"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { CreditCard, Users, UserCheck, Zap } from "lucide-react";

type Stats = {
  totalStudents: number;
  totalInstructors: number;
  sessionsThisWeek: number;
  avgScore: number;
};

const BILLING_HISTORY = [
  { id: "1", date: "Mar 1, 2026", description: "Monthly subscription — Per Instructor plan", amount: "$294.00", status: "Paid" },
  { id: "2", date: "Feb 1, 2026", description: "Monthly subscription — Per Instructor plan", amount: "$294.00", status: "Paid" },
  { id: "3", date: "Jan 1, 2026", description: "Monthly subscription — Per Instructor plan", amount: "$245.00", status: "Paid" },
  { id: "4", date: "Dec 1, 2025", description: "Monthly subscription — Per Instructor plan", amount: "$245.00", status: "Paid" },
];

export default function SchoolBillingPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<"per_instructor" | "per_student">("per_instructor");
  const [showComingSoon, setShowComingSoon] = useState(false);

  function handleComingSoon() {
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 5000);
  }

  useEffect(() => {
    async function load() {
      try {
        const schoolRes = await fetch("/api/school/mine");
        const schoolData = await readJsonResponse<{ school?: { role: string } | null }>(schoolRes);
        if (!schoolData?.school || schoolData.school.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        const statsRes = await fetch("/api/school/admin/stats");
        const statsData = await readJsonResponse<Stats>(statsRes);
        setStats(statsData);
      } catch {
        // silently fail, page still renders with mock data
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const totalSeats = 20; // mock cap
  const activeSeats = (stats?.totalStudents || 0) + (stats?.totalInstructors || 0);
  const availableSeats = Math.max(totalSeats - activeSeats, 0);

  const seatCards = [
    {
      label: "Active Seats",
      value: loading ? "—" : String(activeSeats),
      sub: `${stats?.totalStudents || 0} students · ${stats?.totalInstructors || 0} instructors`,
      icon: Users,
    },
    {
      label: "Total Seats",
      value: String(totalSeats),
      sub: "Current plan limit",
      icon: UserCheck,
    },
    {
      label: "Available",
      value: loading ? "—" : String(availableSeats),
      sub: "Seats remaining",
      icon: Zap,
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">Flight School Subscription</h1>
        <p className="text-muted-foreground text-sm">Manage your plan, seats, and billing</p>
      </div>

      {/* Coming soon banner */}
      {showComingSoon && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <p className="text-sm text-blue-800">
            Billing integration coming soon. Contact us to upgrade your plan.
          </p>
        </div>
      )}

      {/* Seat usage cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {seatCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <div className="h-8 w-8 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <card.icon className="h-4 w-4 text-[#1e3a5f]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleComingSoon}
          className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Add More Seats
        </button>
      </div>

      {/* Subscription plans */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Subscription Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Per Instructor plan */}
          <div
            className={`rounded-xl border-2 p-6 space-y-4 cursor-pointer transition-colors ${
              selectedPlan === "per_instructor"
                ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                : "border-border bg-card hover:border-[#1e3a5f]/40"
            }`}
            onClick={() => setSelectedPlan("per_instructor")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground">Per Instructor</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Best for instructor-led schools</p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                  selectedPlan === "per_instructor" ? "border-[#1e3a5f] bg-[#1e3a5f]" : "border-border"
                }`}
              >
                {selectedPlan === "per_instructor" && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
            <div>
              <span className="text-3xl font-bold text-foreground">$49</span>
              <span className="text-muted-foreground text-sm"> / instructor / month</span>
            </div>
            <ul className="space-y-2">
              {[
                "Unlimited students per instructor",
                "Advanced analytics",
                "Student progress tracking",
                "Custom ACS focus areas",
                "Priority support",
                "Export reports",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); handleComingSoon(); }}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPlan === "per_instructor"
                  ? "bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white"
                  : "bg-secondary hover:bg-secondary/80 text-foreground"
              }`}
            >
              {selectedPlan === "per_instructor" ? "Current Plan" : "Select Plan"}
            </button>
          </div>

          {/* Per Student Seat plan */}
          <div
            className={`rounded-xl border-2 p-6 space-y-4 cursor-pointer transition-colors relative ${
              selectedPlan === "per_student"
                ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                : "border-border bg-card hover:border-[#1e3a5f]/40"
            }`}
            onClick={() => setSelectedPlan("per_student")}
          >
            <div className="absolute -top-3 left-4">
              <span className="bg-[#ff6b35] text-white text-xs font-medium px-3 py-1 rounded-full">
                Most Popular
              </span>
            </div>
            <div className="flex items-start justify-between gap-2 pt-2">
              <div>
                <h3 className="font-semibold text-foreground">Per Student Seat</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Flexible for growing schools</p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                  selectedPlan === "per_student" ? "border-[#1e3a5f] bg-[#1e3a5f]" : "border-border"
                }`}
              >
                {selectedPlan === "per_student" && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
            <div>
              <span className="text-3xl font-bold text-foreground">$19</span>
              <span className="text-muted-foreground text-sm"> / seat / month</span>
            </div>
            <ul className="space-y-2">
              {[
                "Flexible seat allocation",
                "Student self-enrollment",
                "Group analytics",
                "Bulk invite codes",
                "Support for all instructors",
                "Volume discounts available",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); handleComingSoon(); }}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPlan === "per_student"
                  ? "bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white"
                  : "bg-secondary hover:bg-secondary/80 text-foreground"
              }`}
            >
              {selectedPlan === "per_student" ? "Current Plan" : "Select Plan"}
            </button>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Payment Method</h2>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-14 rounded bg-secondary flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Visa ending in 4242</p>
              <p className="text-xs text-muted-foreground">Expires 12/2027</p>
            </div>
          </div>
          <button
            onClick={handleComingSoon}
            className="text-sm text-[#1e3a5f] hover:underline font-medium"
          >
            Update
          </button>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Next billing date: <span className="text-foreground font-medium">Apr 1, 2026</span>
          </p>
          <button
            onClick={handleComingSoon}
            className="text-sm text-[#ef4444] hover:underline"
          >
            Cancel Subscription
          </button>
        </div>
      </div>

      {/* Billing history */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-foreground text-lg font-semibold">Billing History</h2>
        </div>
        <div className="divide-y divide-border">
          {BILLING_HISTORY.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm text-foreground">{item.description}</p>
                <p className="text-xs text-muted-foreground">{item.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground">{item.amount}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#22c55e]/10 text-[#22c55e]">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
