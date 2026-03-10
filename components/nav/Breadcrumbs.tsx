"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { shortId } from "./nav-config";

type Crumb = {
  label: string;
  href?: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  sessions: "Sessions",
  results: "Sessions",
  session: "Oral Session",
  start: "New Session",
  new: "New Session",
  settings: "Settings",
  help: "Help",
  practice: "Practice",
  review: "Review",
};

function buildCrumbs(pathname: string): Crumb[] {
  if (!pathname || pathname === "/") return [{ label: "Dashboard", href: "/dashboard" }];

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Dashboard", href: "/dashboard" }];

  if ((parts[0] === "sessions" || parts[0] === "results") && parts[1]) {
    const base: Crumb[] = [
      { label: "Sessions", href: "/sessions" },
      { label: `Session ${shortId(parts[1])}`, href: `/sessions/${parts[1]}` },
    ];
    if (parts[2] === "review") {
      base.push({ label: "Review" });
    } else if (parts[2] === "debrief") {
      base.push({ label: "Debrief" });
    } else {
      base[base.length - 1] = { label: `Session ${shortId(parts[1])}` };
    }
    return base;
  }

  if (parts[0] === "session" && parts[1]) {
    return [
      { label: "Sessions", href: "/sessions" },
      { label: `Oral ${shortId(parts[1])}` },
    ];
  }

  const crumbs: Crumb[] = [];
  let acc = "";
  for (const segment of parts) {
    acc += `/${segment}`;
    crumbs.push({
      label: SEGMENT_LABELS[segment] || segment.replace(/-/g, " "),
      href: acc,
    });
  }
  if (crumbs.length > 0) crumbs[crumbs.length - 1].href = undefined;
  return crumbs;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                style={{
                  color: "#aab4c2",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span style={{ color: "#dce6f3", fontSize: 13, fontWeight: 700 }}>{crumb.label}</span>
            )}
            {!isLast && <span style={{ color: "#627086", fontSize: 12 }}>/</span>}
          </span>
        );
      })}
    </nav>
  );
}
