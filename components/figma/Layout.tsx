"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ClipboardList, LayoutDashboard, Menu, Plane, Plus, X } from "lucide-react";
import UserDropdown from "@/components/ui/UserDropdown";

export function FigmaLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Sessions", href: "/sessions", icon: ClipboardList },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-border bg-sidebar px-6 py-8">
          <div className="flex h-10 shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e3a5f]">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-[#1e3a5f]">CheckRideReady</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1.5">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
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
            <Link
              href="/sessions/new"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2d5a8f]"
            >
              <Plus className="h-4 w-4" />
              Start New Session
            </Link>
          </nav>
          <div className="border-t border-border pt-4">
            <UserDropdown menuDirection="up" />
          </div>
        </div>
      </div>

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
          <span className="font-semibold text-[#1e3a5f]">CheckRideReady</span>
        </div>
        <UserDropdown trigger="avatar" />
      </div>

      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <button
            aria-label="Close navigation menu"
            className="fixed inset-0 bg-black/30 border-none p-0"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-sidebar px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-semibold text-[#1e3a5f]">CheckRideReady</span>
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
              <ul role="list" className="flex flex-col gap-y-1.5">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
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
              <UserDropdown onNavigate={() => setMobileMenuOpen(false)} />
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
