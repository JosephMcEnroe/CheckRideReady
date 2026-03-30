import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle, Target } from "lucide-react";
import MobileNav from "@/components/marketing/MobileNav";

const FeaturesSection = dynamic(() => import("@/components/marketing/FeaturesSection"), {
  loading: () => <div className="h-96 animate-pulse bg-secondary/30 rounded-xl" />,
});

const HowItWorksSection = dynamic(() => import("@/components/marketing/HowItWorksSection"), {
  loading: () => <div className="h-96 animate-pulse bg-secondary/30 rounded-xl" />,
});

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]">
                <Target className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-[#1e3a5f]">ProCheckride</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-foreground hover:text-[#1e3a5f] transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-foreground hover:text-[#1e3a5f] transition-colors">
                How It Works
              </a>
              <Link href="/login" className="text-sm text-foreground hover:text-[#1e3a5f] transition-colors">
                Login
              </Link>
              <Link
                href="/login"
                className="bg-[#ff6b35] hover:bg-[#ff5722] text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            <MobileNav />
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f]/5 via-transparent to-[#ff6b35]/5" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Hero text — LCP element, rendered server-side */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                  Pass Your Checkride Like a Pro.
                </h1>
                <p className="text-xl text-muted-foreground">
                  AI-powered FAA oral exam simulator built for serious student pilots and flight schools.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-[#ff6b35] hover:bg-[#ff5722] text-white px-8 py-4 rounded-lg font-medium transition-colors shadow-lg"
                >
                  <PlayCircle className="h-5 w-5" />
                  Start Free Trial
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-secondary border border-border text-foreground px-8 py-4 rounded-lg font-medium transition-colors"
                >
                  View Demo
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
                <span>7-day free trial - No credit card required</span>
              </div>
            </div>

            {/* ── Desktop session mockup (full complexity) ── */}
            <div className="hidden sm:block relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border bg-white">
                <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] p-4 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-white/30" />
                    <div className="h-3 w-3 rounded-full bg-white/30" />
                    <div className="h-3 w-3 rounded-full bg-white/30" />
                  </div>
                  <div className="flex-1 text-center text-white text-sm font-medium">ProCheckride Session</div>
                </div>
                <div className="p-6 space-y-4 bg-[#f8f9fa]">
                  <div className="bg-white rounded-lg p-4 border border-border shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <div className="h-5 w-5 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-[10px]">
                        Q
                      </div>
                      <span>DPE Question</span>
                    </div>
                    <p className="text-sm text-foreground">
                      What are the three conditions necessary for structural icing?
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-border">
                    <div className="text-xs text-muted-foreground mb-2">Your Response</div>
                    <div className="space-y-2">
                      <div className="h-2 bg-secondary rounded w-full" />
                      <div className="h-2 bg-secondary rounded w-3/4" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-[#22c55e]/10 to-[#22c55e]/5 rounded-lg p-4 border border-[#22c55e]/20">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#22c55e] mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>AI Feedback</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-[#22c55e]/20 rounded w-full" />
                      <div className="h-2 bg-[#22c55e]/20 rounded w-5/6" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Mobile session mockup (static, no complex layout) ── */}
            <div className="block sm:hidden rounded-2xl overflow-hidden shadow-xl border border-border bg-white">
              <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] p-4 text-center text-white text-sm font-medium">
                ProCheckride Session
              </div>
              <div className="p-5 bg-[#f8f9fa] space-y-3">
                <div className="bg-[#1e3a5f] rounded-lg p-4">
                  <p className="text-white text-sm">
                    What are the three conditions necessary for structural icing?
                  </p>
                </div>
                <div className="flex justify-end">
                  <span className="bg-[#22c55e] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    PASS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Below-fold sections — lazy loaded ───────────────────────────── */}
      <FeaturesSection />
      <HowItWorksSection />

      {/* PRICING SECTION - temporarily hidden
      <section id="pricing" ...>
      </section>
      */}

      <footer className="bg-white border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-border pt-8 text-center">
            <p className="text-sm text-muted-foreground">Copyright 2026 ProCheckride. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
