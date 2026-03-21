"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { WeatherContextCard } from "@/components/figma/WeatherContextCard";
import { CheckCircle, ChevronLeft } from "lucide-react";

type CertGoal = "PPL" | "IR" | "CPL";

const goalOptions: { value: CertGoal; label: string; figmaKey: string }[] = [
  { value: "PPL", label: "Private Pilot", figmaKey: "private" },
  { value: "IR", label: "Instrument Rating", figmaKey: "instrument" },
  { value: "CPL", label: "Commercial Pilot", figmaKey: "commercial" },
];

type WeatherData = {
  airport: string;
  raw?: string;
  wind?: string;
  visibility?: string;
  ceiling?: string;
  conditions?: string;
};

export default function StudentProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [certificateGoal, setCertificateGoal] = useState<CertGoal | null>(null);

  // Step 2 state
  const [airport, setAirport] = useState("");
  const [aircraft, setAircraft] = useState("");
  const [schoolAirportHint, setSchoolAirportHint] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const weatherDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: load context + read localStorage cert goal
  useEffect(() => {
    async function loadContext() {
      try {
        const res = await fetch("/api/user/context");
        if (!res.ok) return;
        const data = await readJsonResponse<{
          user: {
            home_airport?: string | null;
            aircraft_type?: string | null;
            certificate_goal?: string | null;
          };
          school: { icao_identifier?: string | null; name?: string | null } | null;
          effective_airport: string | null;
          school_is_source: boolean;
        }>(res);

        if (data.effective_airport) setAirport(data.effective_airport);
        if (data.user.aircraft_type) setAircraft(data.user.aircraft_type);
        if (data.user.certificate_goal) {
          const match = goalOptions.find((o) => o.value === data.user.certificate_goal);
          if (match) setCertificateGoal(match.value);
        }
        if (data.school_is_source && data.school?.icao_identifier && data.school?.name) {
          setSchoolAirportHint(data.school.name);
        }
      } catch {
        // silently fail
      }
    }

    const stored = localStorage.getItem("certificate_goal");
    if (stored) {
      // stored is figmaKey or API value
      const matchByFigma = goalOptions.find((o) => o.figmaKey === stored || o.value === stored);
      if (matchByFigma) setCertificateGoal(matchByFigma.value);
    }

    loadContext();
  }, []);

  // Weather fetch when airport changes (step 2)
  useEffect(() => {
    if (step !== 2) return;
    if (airport.length !== 4) {
      setWeatherData(null);
      setWeatherError(null);
      return;
    }

    if (weatherDebounce.current) clearTimeout(weatherDebounce.current);
    weatherDebounce.current = setTimeout(async () => {
      setWeatherLoading(true);
      setWeatherError(null);
      setWeatherData(null);
      try {
        const res = await fetch(`/api/weather/metar?icao=${airport}`);
        const data = await readJsonResponse<WeatherData & { error?: string }>(res);
        if (!res.ok) {
          setWeatherError(data?.error || "Failed to fetch weather");
        } else {
          setWeatherData(data);
        }
      } catch {
        setWeatherError("Could not fetch weather data");
      } finally {
        setWeatherLoading(false);
      }
    }, 800);

    return () => {
      if (weatherDebounce.current) clearTimeout(weatherDebounce.current);
    };
  }, [airport, step]);

  async function handleFinish() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_airport: airport || null,
          aircraft_type: aircraft || null,
          certificate_goal: certificateGoal,
        }),
      });
      const data = await readJsonResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || "Failed to save profile");
      setStep(3);
      setTimeout(() => router.push("/start"), 1500);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ─── Step 3: Success ───────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#1e3a5f]">Profile Saved!</h2>
          <p className="text-muted-foreground">Taking you to your session...</p>
        </div>
      </main>
    );
  }

  // ─── Step 1: Choose Certificate ────────────────────────────────────────────
  if (step === 1) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-[#1e3a5f]">What are you training for?</h1>
            <p className="text-muted-foreground">Select your certificate goal</p>
          </div>

          <div className="space-y-3">
            {goalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCertificateGoal(opt.value)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  certificateGoal === opt.value
                    ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                    : "border-border bg-card hover:border-[#1e3a5f]/30"
                }`}
              >
                <p className="font-semibold text-foreground">{opt.label}</p>
                <p className="text-sm text-muted-foreground">{opt.value}</p>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!certificateGoal}
            className="w-full py-3 rounded-xl font-semibold text-white bg-[#ff6b35] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#e55a25] transition-colors"
          >
            Next
          </button>
        </div>
      </main>
    );
  }

  // ─── Step 2: Airport & Aircraft ────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Your Aircraft & Airport</h1>
            <p className="text-sm text-muted-foreground">Help us personalize your sessions</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Home Airport (ICAO)</label>
            <input
              type="text"
              maxLength={4}
              value={airport}
              onChange={(e) => setAirport(e.target.value.toUpperCase())}
              placeholder="e.g. KROC"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
            />
            {schoolAirportHint && (
              <p className="text-xs text-muted-foreground">
                Using your flight school&apos;s location ({schoolAirportHint}). You can change this.
              </p>
            )}
          </div>

          {/* Weather preview */}
          {airport.length === 4 && (
            <WeatherContextCard
              airport={airport}
              loading={weatherLoading}
              error={weatherError ?? undefined}
              wind={weatherData?.wind}
              visibility={weatherData?.visibility}
              ceiling={weatherData?.ceiling}
              metar={weatherData?.raw ?? undefined}
            />
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Aircraft Type</label>
            <input
              type="text"
              value={aircraft}
              onChange={(e) => setAircraft(e.target.value)}
              placeholder="e.g. Cessna 172"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
            />
          </div>
        </div>

        {saveError && (
          <p className="text-sm text-red-600">{saveError}</p>
        )}

        <button
          onClick={handleFinish}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-white bg-[#ff6b35] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#e55a25] transition-colors"
        >
          {saving ? "Saving..." : "Finish Setup"}
        </button>
      </div>
    </main>
  );
}
