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

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 lg:py-32 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">How It Works</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to checkride confidence
          </p>
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
  );
}
