"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Breadcrumbs from "./Breadcrumbs";
import { pageTitleFromPath, quickActionsFromPath } from "./nav-config";

type TopBarProps = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
};

export default function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
}: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitleFromPath(pathname);
  const quickActions = quickActionsFromPath(pathname);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(10, 14, 22, 0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div style={{ padding: "12px 16px 10px 16px", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              aria-label="Open navigation menu"
              className="crr-focusable crr-mobile-only"
              onClick={onOpenMobileNav}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#d5deea",
                borderRadius: 8,
                width: 36,
                height: 36,
                cursor: "pointer",
                fontSize: 17,
                lineHeight: "34px",
              }}
            >
              ☰
            </button>
            <button
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="crr-focusable crr-desktop-only"
              onClick={onToggleSidebar}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#d5deea",
                borderRadius: 8,
                width: 36,
                height: 36,
                cursor: "pointer",
                fontSize: 14,
                lineHeight: "34px",
              }}
            >
              {sidebarCollapsed ? "»" : "«"}
            </button>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#f1f6ff" }}>{title}</h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {quickActions.map((action) => (
              action.href.startsWith("/api/") ? (
                <a
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  className="crr-focusable"
                  style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.24)",
                    color: "#f0f4fb",
                    fontWeight: 800,
                    textDecoration: "none",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  {action.label}
                </a>
              ) : (
                <Link
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  className="crr-focusable"
                  style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.24)",
                    color: "#f0f4fb",
                    fontWeight: 800,
                    textDecoration: "none",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  {action.label}
                </Link>
              )
            ))}
          </div>
        </div>
        <Breadcrumbs />
      </div>
    </header>
  );
}
