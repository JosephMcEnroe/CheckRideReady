"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white px-8 py-3 rounded-lg font-medium transition-colors"
    >
      Sign Out
    </button>
  );
}
