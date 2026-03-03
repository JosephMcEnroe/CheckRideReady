"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { CreditCard, LogOut, Shield, User } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type UserRole = "student" | "instructor" | "admin";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
};

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "U").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function normalizeRole(role?: string | null): UserRole | null {
  if (role === "student" || role === "instructor" || role === "admin") return role;
  return null;
}

const roleBadgeClass: Record<UserRole, string> = {
  student: "bg-blue-100 text-blue-700 border-blue-200",
  instructor: "bg-purple-100 text-purple-700 border-purple-200",
  admin: "bg-red-100 text-red-700 border-red-200",
};

type UserDropdownProps = {
  trigger?: "full" | "avatar";
  menuDirection?: "up" | "down";
  onNavigate?: () => void;
};

export default function UserDropdown({
  trigger = "full",
  menuDirection = "down",
  onNavigate,
}: UserDropdownProps) {
  const { data } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const user = (data?.user || {}) as SessionUser;
  const role = normalizeRole(user.role);
  const userInitials = useMemo(() => initials(user.name, user.email), [user.name, user.email]);
  const nameLabel = user.name || user.email || "Signed in user";
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";
  const secondaryItem = role === "admin" ? { label: "Admin Panel", href: "/admin" } : { label: "Billing", href: "/billing" };
  const secondaryActive = pathname === secondaryItem.href || pathname.startsWith(`${secondaryItem.href}/`);
  const SecondaryIcon = role === "admin" ? Shield : CreditCard;
  const menuPositionClass = menuDirection === "up" ? "bottom-full mb-2" : "top-full mt-2";

  function handleClose() {
    setOpen(false);
    onNavigate?.();
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          trigger === "avatar" ? "h-9 w-9 justify-center hover:bg-secondary/80" : "gap-3 px-2 py-1.5 hover:bg-sidebar-accent"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Open account menu"
      >
        <div className="h-9 w-9 rounded-full overflow-hidden bg-primary text-primary-foreground border border-border flex items-center justify-center text-sm font-semibold">
          {user.image ? (
            <img src={user.image} alt={user.name || "User avatar"} className="h-9 w-9 object-cover" />
          ) : (
            userInitials
          )}
        </div>
        {trigger === "full" ? (
          <div className="text-left leading-tight">
            <p className="text-sm font-medium text-foreground truncate max-w-[160px]">{nameLabel}</p>
            <span
              className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${role ? roleBadgeClass[role] : "bg-secondary text-muted-foreground border-border"}`}
            >
              {roleLabel}
            </span>
          </div>
        ) : null}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="User account menu"
          className={`absolute right-0 w-56 rounded-xl border border-border bg-white p-2 shadow-[0_12px_30px_rgba(0,0,0,0.12)] z-50 ${menuPositionClass}`}
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={handleClose}
            className="flex items-center rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:bg-secondary"
          >
            <User className="mr-2 h-4 w-4 text-muted-foreground" />
            Account
          </Link>
          <Link
            href={secondaryItem.href}
            role="menuitem"
            onClick={handleClose}
            className={`flex items-center rounded-lg px-3 py-2 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:bg-secondary ${
              secondaryActive ? "text-orange-600 bg-orange-50" : "text-foreground"
            }`}
          >
            <SecondaryIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {secondaryItem.label}
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onNavigate?.();
              signOut({ callbackUrl: "/" });
            }}
            className="flex w-full items-center rounded-lg bg-[#ff6a35] px-3 py-2 text-sm font-medium text-white hover:bg-[#ef5d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a35]/50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
