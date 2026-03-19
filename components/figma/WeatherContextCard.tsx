"use client";

import { Cloud } from "lucide-react";

type WeatherContextCardProps = {
  airport: string;
  city?: string;
  wind?: string;
  visibility?: string;
  ceiling?: string;
  metar?: string;
  loading?: boolean;
  error?: string;
};

export function WeatherContextCard({
  airport,
  city,
  wind,
  visibility,
  ceiling,
  metar,
  loading,
  error,
}: WeatherContextCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg bg-[#eff6ff] border border-blue-100 p-4">
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Cloud className="h-4 w-4 animate-pulse" />
          <span>Fetching weather for {airport}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-100 p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#eff6ff] border border-blue-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-blue-500" />
        <span className="font-semibold text-foreground">{airport}</span>
        {city && <span className="text-sm text-muted-foreground">— {city}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {wind && (
          <span className="px-2 py-1 rounded-md bg-white border border-blue-100 text-xs text-foreground">
            Wind: {wind}
          </span>
        )}
        {visibility && (
          <span className="px-2 py-1 rounded-md bg-white border border-blue-100 text-xs text-foreground">
            Vis: {visibility}
          </span>
        )}
        {ceiling && (
          <span className="px-2 py-1 rounded-md bg-white border border-blue-100 text-xs text-foreground">
            Ceiling: {ceiling}
          </span>
        )}
      </div>
      {metar && (
        <p className="text-xs font-mono text-muted-foreground break-all">{metar}</p>
      )}
    </div>
  );
}
