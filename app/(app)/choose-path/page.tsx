"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plane, Gauge, Briefcase } from "lucide-react";

type TrainingPath = "PPL" | "IR" | "CPL";

const paths: {
  id: TrainingPath;
  label: string;
  subtitle: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  icon: React.ReactNode;
}[] = [
  {
    id: "PPL",
    label: "Private Pilot",
    subtitle: "PPL",
    description: "Foundation of flight training covering basic aeronautical knowledge and skills",
    difficulty: "Beginner",
    icon: <Plane className="h-6 w-6" />,
  },
  {
    id: "IR",
    label: "Instrument Rating",
    subtitle: "IR",
    description: "Advanced training for flying in instrument meteorological conditions",
    difficulty: "Intermediate",
    icon: <Gauge className="h-6 w-6" />,
  },
  {
    id: "CPL",
    label: "Commercial Pilot",
    subtitle: "CPL",
    description: "Professional pilot certification for flying as a career",
    difficulty: "Advanced",
    icon: <Briefcase className="h-6 w-6" />,
  },
];

const difficultyColors: Record<string, string> = {
  Beginner: "bg-[#22c55e]/10 text-[#22c55e]",
  Intermediate: "bg-[#fbbf24]/10 text-[#fbbf24]",
  Advanced: "bg-[#fb923c]/10 text-[#fb923c]",
};

export default function ChoosePathPage() {
  const router = useRouter();
  const [selectedPath, setSelectedPath] = useState<TrainingPath | null>(null);
  const [isInstructor, setIsInstructor] = useState(false);

  function handleContinue() {
    if (selectedPath) {
      localStorage.setItem("certificate_goal", selectedPath);
    }
    if (isInstructor) {
      router.push("/school/setup");
    } else {
      router.push("/student/profile");
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Choose Your Path</h1>
          <p className="text-muted-foreground">Select the certificate you&apos;re training for</p>
        </div>

        {/* Path Cards */}
        <div className="space-y-3">
          {paths.map((path) => (
            <button
              key={path.id}
              onClick={() => setSelectedPath(path.id)}
              className={`w-full text-left rounded-xl p-4 border-2 transition-all ${
                selectedPath === path.id
                  ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                  : "border-border hover:border-[#1e3a5f]/30 bg-card"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    selectedPath === path.id
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {path.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{path.label}</span>
                    <span className="text-xs text-muted-foreground">{path.subtitle}</span>
                    <span
                      className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColors[path.difficulty]}`}
                    >
                      {path.difficulty}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{path.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Instructor Toggle */}
        <div className="rounded-xl border-2 border-border bg-card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">I&apos;m a Flight Instructor</p>
            <p className="text-sm text-muted-foreground">Set up a school account instead</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isInstructor}
              onChange={(e) => setIsInstructor(e.target.checked)}
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-[#1e3a5f] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 after:shadow-sm" />
          </label>
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            disabled={!selectedPath}
            className="w-full max-w-xs py-3 px-6 rounded-xl font-semibold text-white bg-[#ff6b35] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#e55a25] transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}
