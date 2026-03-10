import { Bell, HelpCircle, Shield, User } from "lucide-react";
import { auth } from "@/auth";
import SignOutButton from "@/components/nav/SignOutButton";

export default async function SettingsPage() {
  const session = await auth();
  const name = session?.user?.name || "";
  const email = session?.user?.email || "";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-foreground">Account</h1>
        <p className="text-muted-foreground">Manage your account preferences and application settings</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-[#1e3a5f]" />
          <h2 className="font-semibold text-foreground">Profile Information</h2>
        </div>
        <div className="space-y-4 pl-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Full Name</label>
              <input
                type="text"
                value={name}
                readOnly
                className="w-full p-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full p-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-[#1e3a5f]" />
          <h2 className="font-semibold text-foreground">Notifications</h2>
        </div>
        <div className="space-y-3 pl-8">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-foreground">Email notifications for session completion</span>
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border text-[#1e3a5f] focus:ring-[#1e3a5f]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-foreground">Weekly progress reports</span>
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border text-[#1e3a5f] focus:ring-[#1e3a5f]" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-foreground">Study reminders</span>
            <input type="checkbox" className="h-4 w-4 rounded border-border text-[#1e3a5f] focus:ring-[#1e3a5f]" />
          </label>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-[#1e3a5f]" />
          <h2 className="font-semibold text-foreground">Privacy and Security</h2>
        </div>
        <div className="space-y-3 pl-8">
          <button className="text-sm text-[#1e3a5f] hover:text-[#2d5a8f] transition-colors">Change Password</button>
          <div className="border-t border-border pt-3">
            <button className="text-sm text-destructive hover:underline">Delete Account</button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-5 w-5 text-[#1e3a5f]" />
          <h2 className="font-semibold text-foreground">Help and Support</h2>
        </div>
        <div className="space-y-3 pl-8">
          <a href="#" className="block text-sm text-[#1e3a5f] hover:text-[#2d5a8f] transition-colors">
            Documentation
          </a>
          <a href="#" className="block text-sm text-[#1e3a5f] hover:text-[#2d5a8f] transition-colors">
            Contact Support
          </a>
          <a href="#" className="block text-sm text-[#1e3a5f] hover:text-[#2d5a8f] transition-colors">
            FAQs
          </a>
        </div>
      </div>

      <div className="flex justify-end">
        <SignOutButton />
      </div>
    </div>
  );
}
