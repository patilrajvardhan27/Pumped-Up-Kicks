import Card from "./Card";

export default function Features() {
  const features = [
    {
      title: "AI-Powered Analysis",
      description: "Our AI analyzes your lectures to extract key insights and concepts",
      color: "electric-blueberry" as const,
      icon: "🤖",
    },
    {
      title: "Smart Q&A",
      description: "Ask questions about your lectures and get instant, accurate answers",
      color: "teal-tango" as const,
      icon: "💬",
    },
    {
      title: "Timestamp Navigation",
      description: "Jump to exact moments in videos based on topics and questions",
      color: "lavender-latte" as const,
      icon: "⏱️",
    },
    {
      title: "Knowledge Graphs",
      description: "Visualize connections between concepts across all your lectures",
      color: "rosy-posy" as const,
      icon: "🕸️",
    },
  ];

  return (
    <section id="features" className="py-20 px-6 bg-cloud-nine">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-charcoal-champion text-center mb-12">
          Supercharge Your Learning
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <Card key={index} accentColor={feature.color}>
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-2xl font-bold text-midnight-mystery mb-3">
                {feature.title}
              </h3>
              <p className="text-storm-cloud">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
