"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { WeatherContextCard } from "@/components/figma/WeatherContextCard";
import { Pencil, Check, AlertTriangle } from "lucide-react";

type Certificate = "Private" | "Instrument" | "Commercial";

const ACS_FOCUS_AREAS: Record<Certificate, string[]> = {
  Private: [
    "Preflight Preparation",
    "Preflight Procedures",
    "Airport & Airspace",
    "Weather Information",
    "Cross-Country Flight",
    "Night Operations",
    "Emergency Operations",
    "Post-Flight Procedures",
  ],
  Instrument: [
    "Regulations & Publications",
    "Instrument Flight",
    "Navigation Systems",
    "Approaches",
    "Holding Procedures",
    "Emergency Operations",
    "Weather",
  ],
  Commercial: [
    "Preflight Preparation",
    "Commercial Operations",
    "Maneuvers",
    "Navigation",
    "Slow Flight & Stalls",
    "Emergency Operations",
    "Post-Flight Procedures",
  ],
};

const modeMap: Record<Certificate, "PPL" | "IR" | "CPL"> = {
  Private: "PPL",
  Instrument: "IR",
  Commercial: "CPL",
};

const goalToCert: Record<string, Certificate> = {
  PPL: "Private",
  IR: "Instrument",
  CPL: "Commercial",
};

type WeatherData = {
  airport: string;
  raw?: string;
  wind?: string;
  visibility?: string;
  ceiling?: string;
  conditions?: string;
};

export default function StartPage() {
  const router = useRouter();

  const [certificate, setCertificate] = useState<Certificate>("Private");
  const [airport, setAirport] = useState("");
  const [aircraft, setAircraft] = useState("");
  const [editingAirport, setEditingAirport] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [profileMissing, setProfileMissing] = useState(false);

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weatherDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await readJsonResponse<{
          home_airport?: string | null;
          aircraft_type?: string | null;
          certificate_goal?: string | null;
        }>(res);

        if (!data.home_airport && !data.aircraft_type && !data.certificate_goal) {
          setProfileMissing(true);
        }

        if (data.home_airport) setAirport(data.home_airport);
        if (data.aircraft_type) setAircraft(data.aircraft_type);
        if (data.certificate_goal && goalToCert[data.certificate_goal]) {
          setCertificate(goalToCert[data.certificate_goal]);
        }
      } catch {
        // silently fail
      }
    }
    loadProfile();
  }, []);

  // Fetch weather when airport changes
  useEffect(() => {
    if (!airport || airport.length !== 4) {
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
          setWeatherError(data?.error || "Weather unavailable");
        } else {
          setWeatherData(data);
        }
      } catch {
        setWeatherError("Could not fetch weather");
      } finally {
        setWeatherLoading(false);
      }
    }, 800);

    return () => {
      if (weatherDebounce.current) clearTimeout(weatherDebounce.current);
    };
  }, [airport]);

  function toggleArea(area: string) {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  async function handleBegin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeMap[certificate],
          airport: airport || null,
          aircraft: aircraft || null,
          focusAreas: selectedAreas,
          weather: weatherData
            ? {
                raw: weatherData.raw,
                wind: weatherData.wind,
                visibility: weatherData.visibility,
                ceiling: weatherData.ceiling,
              }
            : null,
        }),
      });
      const data = await readJsonResponse<{ sessionId?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || "Failed to start session");
      router.push(`/sessions/${data.sessionId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setLoading(false);
    }
  }

  const focusAreas = ACS_FOCUS_AREAS[certificate];

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Profile missing banner */}
        {profileMissing && (
          <div className="flex items-center gap-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800 flex-1">
              Complete your profile for weather-based sessions
            </p>
            <button
              onClick={() => router.push("/student/profile")}
              className="text-sm font-semibold text-[#ff6b35] hover:underline shrink-0"
            >
              Set Up Profile
            </button>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Start a Session</h1>
          <p className="text-muted-foreground mt-1">Configure your oral exam practice</p>
        </div>

        {/* Certificate Selection */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Certificate</h2>
          <div className="flex gap-2 flex-wrap">
            {(["Private", "Instrument", "Commercial"] as Certificate[]).map((cert) => (
              <button
                key={cert}
                onClick={() => {
                  setCertificate(cert);
                  setSelectedAreas([]);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  certificate === cert
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-card text-foreground border-border hover:border-[#1e3a5f]/40"
                }`}
              >
                {cert}
              </button>
            ))}
          </div>
        </div>

        {/* Airport Card */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Airport</h2>
            <button
              onClick={() => setEditingAirport((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              {editingAirport ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>

          {editingAirport ? (
            <input
              type="text"
              maxLength={4}
              value={airport}
              onChange={(e) => setAirport(e.target.value.toUpperCase())}
              placeholder="ICAO code e.g. KROC"
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
            />
          ) : (
            <p className="text-sm text-foreground">{airport || <span className="text-muted-foreground">No airport set — click edit to add one</span>}</p>
          )}

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
        </div>

        {/* Aircraft */}
        {aircraft && (
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <h2 className="font-semibold text-foreground mb-1">Aircraft</h2>
            <p className="text-sm text-muted-foreground">{aircraft}</p>
          </div>
        )}

        {/* ACS Focus Areas */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-foreground">Focus Areas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Optional — select specific ACS areas to emphasize</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {focusAreas.map((area) => (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedAreas.includes(area)
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-card text-foreground border-border hover:border-[#1e3a5f]/40"
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        {/* Begin Button */}
        <div className="flex flex-col items-center gap-2 pb-8">
          <button
            onClick={handleBegin}
            disabled={loading}
            className="w-full max-w-sm py-4 rounded-xl font-bold text-white text-lg bg-[#ff6b35] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#e55a25] transition-colors shadow-sm"
          >
            {loading ? "Starting..." : "Begin Session"}
          </button>
          <p className="text-xs text-muted-foreground">Estimated 20–30 min</p>
        </div>
      </div>
    </main>
  );
}
