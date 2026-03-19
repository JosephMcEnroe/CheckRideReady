"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Menu,
  MessageSquare,
  PlayCircle,
  Target,
  X,
  Zap,
} from "lucide-react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: MessageSquare,
      title: "Realistic AI DPE Simulation",
      description:
        "Practice with an AI examiner that asks probing questions just like a real Designated Pilot Examiner.",
    },
    {
      icon: Zap,
      title: "Instant Feedback and Probing",
      description:
        "Get immediate, detailed feedback on your responses with follow-up questions to test your depth of knowledge.",
    },
    {
      icon: Target,
      title: "PASS / PROBE / REMEDIATE Scoring",
      description:
        "Understand exactly where you stand with industry-standard evaluation criteria used by real examiners.",
    },
    {
      icon: FileText,
      title: "Downloadable Debrief Reports",
      description:
        "Share professional PDF reports with your CFI to track progress and identify areas for improvement.",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Start a Session",
      description: "Choose your topic and begin the oral exam simulation",
    },
    {
      number: "2",
      title: "Answer Questions",
      description: "Respond to DPE-style questions with AI probing and feedback",
    },
    {
      number: "3",
      title: "Review Performance",
      description: "Get your detailed debrief report with strengths and areas to improve",
    },
  ];

  const pricing = [
    {
      name: "Free Trial",
      price: "$0",
      period: "7 days",
      features: ["3 practice sessions", "Basic feedback", "Session history", "Progress tracking"],
      cta: "Start Free Trial",
      highlighted: false,
    },
    {
      name: "Pro Plan",
      price: "$29",
      period: "per month",
      features: [
        "Unlimited sessions",
        "Advanced AI feedback",
        "Downloadable reports",
        "All topic areas",
        "Priority support",
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Flight School",
      price: "Custom",
      period: "contact us",
      features: [
        "Multiple student accounts",
        "Instructor dashboard",
        "Custom training modules",
        "Analytics and reporting",
        "Dedicated support",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

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
              <a href="#pricing" className="text-sm text-foreground hover:text-[#1e3a5f] transition-colors">
                Pricing
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

            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen((v) => !v)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-3 border-t border-border">
              <a href="#features" className="block text-sm text-foreground" onClick={() => setMobileMenuOpen(false)}>
                Features
              </a>
              <a href="#how-it-works" className="block text-sm text-foreground" onClick={() => setMobileMenuOpen(false)}>
                How It Works
              </a>
              <a href="#pricing" className="block text-sm text-foreground" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </a>
              <Link href="/login" className="block text-sm text-foreground" onClick={() => setMobileMenuOpen(false)}>
                Login
              </Link>
              <Link
                href="/login"
                className="block bg-[#ff6b35] text-white px-6 py-2 rounded-lg font-medium text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Start Free Trial
              </Link>
            </div>
          )}
        </div>
      </nav>

      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f]/5 via-transparent to-[#ff6b35]/5" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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

            <div className="relative">
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
          </div>
        </div>
      </section>

      <section id="features" className="py-20 lg:py-32 border-y border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Everything You Need to Ace Your Oral</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Train like you will be tested. Our AI examiner simulates the real checkride experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
              >
                <div className="h-12 w-12 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-[#1e3a5f]" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 lg:py-32 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Three simple steps to checkride confidence</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => (
              <div key={step.number} className="relative text-center space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {step.number}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Choose the plan that fits your training needs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-8 space-y-6 ${
                  plan.highlighted
                    ? "bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8f] text-white border-[#1e3a5f] shadow-xl"
                    : "bg-card border-border shadow-sm"
                }`}
              >
                <div className="space-y-2">
                  <h3 className={`text-xl font-semibold ${plan.highlighted ? "text-white" : "text-foreground"}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.highlighted ? "text-white" : "text-foreground"}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlighted ? "text-white/70" : "text-muted-foreground"}`}>
                      {plan.period}
                    </span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className={`h-5 w-5 shrink-0 ${plan.highlighted ? "text-white" : "text-[#22c55e]"}`} />
                      <span className={`text-sm ${plan.highlighted ? "text-white" : "text-foreground"}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`block w-full text-center px-6 py-3 rounded-lg font-medium transition-colors ${
                    plan.highlighted
                      ? "bg-[#ff6b35] hover:bg-[#ff5722] text-white"
                      : "bg-[#1e3a5f] hover:bg-[#2d5a8f] text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

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

