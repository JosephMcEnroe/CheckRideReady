"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="md:hidden p-2" onClick={() => setOpen((v) => !v)}>
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {open && (
        <div className="md:hidden py-4 space-y-3 border-t border-border">
          <a href="#features" className="block text-sm text-foreground" onClick={() => setOpen(false)}>
            Features
          </a>
          <a href="#how-it-works" className="block text-sm text-foreground" onClick={() => setOpen(false)}>
            How It Works
          </a>
          <Link href="/login" className="block text-sm text-foreground" onClick={() => setOpen(false)}>
            Login
          </Link>
          <Link
            href="/login"
            className="block bg-[#ff6b35] text-white px-6 py-2 rounded-lg font-medium text-center"
            onClick={() => setOpen(false)}
          >
            Start Free Trial
          </Link>
        </div>
      )}
    </>
  );
}
