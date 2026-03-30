import { FileText, MessageSquare, Target, Zap } from "lucide-react";

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

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-32 border-y border-border bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Everything You Need to Ace Your Oral
          </h2>
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
  );
}
