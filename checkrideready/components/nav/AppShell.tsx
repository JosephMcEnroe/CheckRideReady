"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import TopBar from "./TopBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#070b12", color: "#eaf0f9" }}>
      <Sidebar collapsed={sidebarCollapsed} />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateRows: "auto 1fr" }}>
        <TopBar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main style={{ minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}

