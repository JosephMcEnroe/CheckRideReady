"use client";

import UserDropdown from "@/components/ui/UserDropdown";

export default function Navbar() {
  return (
    <header className="h-16 border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="text-lg font-semibold text-[#1e3a5f]">CheckRideReady</div>
        <UserDropdown />
      </div>
    </header>
  );
}
