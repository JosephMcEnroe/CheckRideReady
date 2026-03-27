"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart2,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Plane,
  Plus,
  Settings2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import UserDropdown from "@/components/ui/UserDropdown";
import { readJsonResponse } from "@/lib/http";

type School = {
  id: string;
  name: string;
  role: string;
};

export function FigmaLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [school, setSchool] = useState<School | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/school/mine")
      .then((res) => readJsonResponse<{ school?: School | null }>(res))
      .then((data) => setSchool(data.school ?? null))
      .catch(() => setSchool(null));
  }, []);

  const dashboardHref =
    school?.role === "admin"
      ? "/school/dashboard"
      : school?.role === "instructor"
      ? "/instructor"
      : "/dashboard";

  const baseNavigation = [
    { name: "Dashboard", href: dashboardHref, icon: LayoutDashboard },
    { name: "Sessions", href: "/sessions", icon: ClipboardList },
  ];

  const schoolNavigation =
    school?.role === "admin"
      ? [
          { name: "School", href: "/school/invite", icon: Building2 },
          { name: "Students", href: "/school/students", icon: Users },
          { name: "Analytics", href: "/school/analytics", icon: BarChart2 },
          { name: "Settings", href: "/school/settings", icon: Settings2 },
        ]
      : school?.role === "instructor"
      ? [{ name: "My Students", href: "/instructor", icon: Users }]
      : [];

  const studentNavigation =
    school === null || school?.role === "student"
      ? [{ name: "My Progress", href: "/progress", icon: TrendingUp }]
      : [];

  const navigation = [...baseNavigation, ...studentNavigation, ...schoolNavigation];

  const isActive = (path: string) => {
    if (path === "/dashboard" || path === "/school/dashboard" || path === "/instructor") {
      return (
        pathname === "/dashboard" ||
        pathname === "/school/dashboard" ||
        pathname === "/instructor"
      );
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <ul role="list" className="flex flex-1 flex-col gap-y-1.5">
      {navigation.map((item) => (
        <li key={item.name}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center gap-x-3 rounded-lg px-2 py-2.5 transition-colors ${
              isActive(item.href)
                ? "text-[#1e3a5f] font-medium"
                : "text-sidebar-foreground hover:text-[#1e3a5f]"
            }`}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.name}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-border bg-sidebar px-6 py-8">
          <div className="flex h-10 shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e3a5f]">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-[#1e3a5f]">ProCheckride</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <NavLinks />
            <Link
              href="/sessions/new"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2d5a8f]"
            >
              <Plus className="h-4 w-4" />
              Start New Session
            </Link>
          </nav>
          <div className="border-t border-border pt-4">
            <UserDropdown menuDirection="up" school={school} />
          </div>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-sidebar px-4 py-4 shadow-sm sm:px-6 lg:hidden border-b border-border">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-sidebar-foreground crr-focusable"
          aria-label="Open navigation menu"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]">
            <Plane className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-[#1e3a5f]">ProCheckride</span>
        </div>
        <UserDropdown trigger="avatar" school={school} />
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <button
            aria-label="Close navigation menu"
            className="fixed inset-0 bg-black/30 border-none p-0"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-sidebar px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-semibold text-[#1e3a5f]">ProCheckride</span>
              <button
                type="button"
                className="p-2.5 crr-focusable"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-6 w-6 text-sidebar-foreground" />
              </button>
            </div>
            <nav className="flex-1">
              <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
              <Link
                href="/sessions/new"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2d5a8f]"
              >
                <Plus className="h-4 w-4" />
                Start New Session
              </Link>
            </nav>
            <div className="border-t border-border pt-4 mt-6">
              <UserDropdown onNavigate={() => setMobileMenuOpen(false)} school={school} />
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <main className="py-8 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
