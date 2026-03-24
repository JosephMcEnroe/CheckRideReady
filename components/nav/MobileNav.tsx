"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";

type MobileNavProps = {
  open: boolean;
  onClose: () => void;
};

function isActive(pathname: string, href: string) {
  if (href === "/sessions") return pathname === "/sessions" || pathname.startsWith("/sessions/") || pathname === "/results" || pathname.startsWith("/results/");
  if (href === "/sessions/new") return pathname === "/sessions/new" || pathname === "/start";
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation menu"
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4,8,14,0.68)",
            border: "none",
            zIndex: 49,
            cursor: "pointer",
          }}
        />
      )}
      <aside
        aria-label="Mobile navigation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: "85vw",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 190ms ease",
          background: "linear-gradient(180deg, #0b111a 0%, #0a0f17 100%)",
          borderRight: "1px solid rgba(255,255,255,0.12)",
          zIndex: 50,
          padding: 16,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#f5f7fb", fontWeight: 900, fontSize: 16 }}>ProCheckride</div>
            <div style={{ color: "#90a0b7", fontSize: 12 }}>Pilot Oral Prep</div>
          </div>
          <button
            aria-label="Close navigation menu"
            className="crr-focusable"
            onClick={onClose}
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              color: "#d5deea",
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: "pointer",
              fontSize: 20,
              lineHeight: "34px",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="crr-focusable"
                style={{
                  padding: "11px 12px",
                  borderRadius: 10,
                  color: active ? "#f3f8ff" : "#b5c1d3",
                  background: active ? "rgba(93, 162, 255, 0.20)" : "transparent",
                  border: active ? "1px solid rgba(93, 162, 255, 0.6)" : "1px solid rgba(255,255,255,0.06)",
                  textDecoration: "none",
                  fontWeight: active ? 800 : 600,
                  fontSize: 14,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}

