"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";

type SidebarProps = {
  collapsed: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/sessions") return pathname === "/sessions" || pathname.startsWith("/sessions/") || pathname === "/results" || pathname.startsWith("/results/");
  if (href === "/sessions/new") return pathname === "/sessions/new" || pathname === "/start";
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary navigation"
      style={{
        width: collapsed ? 84 : 246,
        transition: "width 180ms ease",
        borderRight: "1px solid rgba(255,255,255,0.10)",
        background: "linear-gradient(180deg, #0b111a 0%, #0a0f17 100%)",
        padding: "16px 12px",
      }}
      className="crr-sidebar-desktop"
    >
      <div style={{ padding: collapsed ? "6px 4px 18px 4px" : "6px 8px 18px 8px" }}>
        <div style={{ color: "#f5f7fb", fontWeight: 900, letterSpacing: 0.4, fontSize: collapsed ? 14 : 16 }}>
          {collapsed ? "CRR" : "ProCheckride"}
        </div>
        {!collapsed && <div style={{ color: "#90a0b7", marginTop: 2, fontSize: 12 }}>Pilot Oral Prep</div>}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="crr-focusable"
              style={{
                padding: collapsed ? "10px 8px" : "10px 12px",
                borderRadius: 10,
                color: active ? "#f3f8ff" : "#b5c1d3",
                background: active ? "rgba(93, 162, 255, 0.20)" : "transparent",
                border: active ? "1px solid rgba(93, 162, 255, 0.6)" : "1px solid transparent",
                textDecoration: "none",
                fontWeight: active ? 800 : 600,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: collapsed ? ("center" as const) : ("left" as const),
              }}
              title={collapsed ? item.label : undefined}
            >
              {collapsed ? item.label.charAt(0) : item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
