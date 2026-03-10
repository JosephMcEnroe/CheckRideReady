"use client";

import { Check, Plane } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const callbackUrl = useMemo(() => {
    const requested = searchParams.get("callbackUrl");
    return requested && requested.startsWith("/") ? requested : "/dashboard";
  }, [searchParams]);

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  const highlights = [
    "Simulated DPE questioning",
    "ACS performance tracking",
    "Instructor analytics",
  ];

  const handleMagicLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsEmailLoading(true);

    try {
      const result = await signIn("email", {
        email,
        callbackUrl,
        redirect: false,
      });

      if (!result || result.error) {
        setErrorMessage(
          "Email sign-in is not available right now. Use Google sign-in or configure an Email provider in NextAuth."
        );
        return;
      }

      setInfoMessage("Magic link sent. Check your email inbox to continue.");
    } catch {
      setErrorMessage("Unable to send magic link right now. Please try again.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsGoogleLoading(true);

    try {
      await signIn("google", { callbackUrl });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="hidden lg:flex lg:flex-1 bg-primary px-12 py-10 flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#1e3a5f] opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-accent rounded-xl p-2.5">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xl font-semibold">CheckRideReady</span>
          </div>

          <h1 className="text-white text-[32px] font-bold mb-3 leading-tight">
            Train Smarter.<br />Pass Confident.
          </h1>

          <p className="text-white/80 text-sm mb-8">
            AI-powered oral exam preparation designed for serious pilots and flight schools.
          </p>

          <div className="space-y-4">
            {highlights.map((highlight) => (
              <div key={highlight} className="flex items-center gap-3">
                <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-[15px]">{highlight}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-white/60 text-[13px]">Trusted by 500+ student pilots and 50+ flight schools</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-6 bg-background">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="bg-accent rounded-xl p-2.5">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <span className="text-primary text-xl font-semibold">CheckRideReady</span>
          </div>

          <div className="bg-card rounded-xl border border-border px-7 py-6 shadow-lg">
            <div className="text-center mb-5">
              <h2 className="text-foreground mb-1.5 text-[20px] font-semibold">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-muted-foreground text-[14px]">
                {isSignUp ? "Start your journey to checkride success" : "Continue your training"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isEmailLoading}
              className="w-full h-10 mb-4 border border-border rounded-lg text-[14px] bg-card hover:bg-secondary text-foreground transition-colors inline-flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 mr-2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-[13px] text-muted-foreground">or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-[13px] text-foreground block mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isGoogleLoading || isEmailLoading}
                  className="w-full h-10 px-3.5 text-[14px] rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={isGoogleLoading || isEmailLoading}
                className="w-full h-10 text-[14px] rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-95 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isEmailLoading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>

            {errorMessage ? (
              <p className="text-[12px] text-destructive text-center mt-3" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {infoMessage ? (
              <p className="text-[12px] text-green-700 text-center mt-3" role="status">
                {infoMessage}
              </p>
            ) : null}

            <p className="text-[11px] text-muted-foreground text-center mt-3">
              We&apos;ll email you a secure sign-in link. No password needed.
            </p>

            <div className="mt-4 text-center pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setIsSignUp((prev) => !prev)}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don&apos;t have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
