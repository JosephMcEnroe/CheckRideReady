export type NavItem = {
  label: string;
  href: string;
};

export type QuickAction = {
  label: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sessions", href: "/sessions" },
  { label: "New Session", href: "/sessions/new" },
  { label: "Practice", href: "/practice" },
  { label: "Settings", href: "/settings" },
  { label: "Help", href: "/help" },
];

function normalize(pathname: string) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function isSessionsListPath(pathname: string) {
  const path = normalize(pathname);
  return path === "/sessions" || path === "/results";
}

export function isSessionDebriefPath(pathname: string) {
  const path = normalize(pathname);
  return /^\/(sessions|results)\/[^/]+(?:\/(debrief|review))$/.test(path);
}

export function isLiveSessionPath(pathname: string) {
  return /^\/sessions\/[^/]+$/.test(normalize(pathname));
}

export function sessionIdFromPath(pathname: string): string | null {
  const path = normalize(pathname);
  const match = path.match(/^\/(?:sessions|results)\/([^/]+)/);
  return match?.[1] || null;
}

export function shortId(id: string | null | undefined) {
  if (!id) return "Unknown";
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function pageTitleFromPath(pathname: string) {
  const path = normalize(pathname);
  if (path === "/" || path === "/dashboard") return "Dashboard";
  if (path === "/sessions" || path === "/results") return "Sessions";
  if (path === "/sessions/new" || path === "/start") return "New Session";
  if (path === "/settings") return "Settings";
  if (path === "/help") return "Help";
  if (path === "/practice") return "Practice";

  if (/^\/sessions\/[^/]+$/.test(path)) return "Oral Session";
  if (/^\/(sessions|results)\/[^/]+\/review$/.test(path)) return "Session Review";
  if (/^\/(sessions|results)\/[^/]+\/debrief$/.test(path)) return "Session Debrief";
  if (/^\/(sessions|results)\/[^/]+$/.test(path)) return "Session";

  return "CheckRideReady";
}

export function quickActionsFromPath(pathname: string): QuickAction[] {
  const path = normalize(pathname);

  if (path === "/dashboard") {
    return [{ label: "Start New Session", href: "/sessions/new" }];
  }
  if (isSessionsListPath(path)) {
    return [{ label: "New Session", href: "/sessions/new" }];
  }
  if (isSessionDebriefPath(path)) {
    const id = sessionIdFromPath(path);
    if (!id) return [{ label: "Back to Sessions", href: "/sessions" }];
    return [
      { label: "Back to Sessions", href: "/sessions" },
      { label: "Download PDF", href: `/api/sessions/${id}/pdf` },
    ];
  }
  if (isLiveSessionPath(path)) {
    const id = sessionIdFromPath(path);
    if (!id) return [{ label: "Back to Sessions", href: "/sessions" }];
    return [
      { label: "Back to Sessions", href: "/sessions" },
      { label: "View Debrief", href: `/sessions/${id}/debrief` },
    ];
  }

  return [];
}
