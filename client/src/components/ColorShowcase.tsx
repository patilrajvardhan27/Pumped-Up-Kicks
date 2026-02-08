'use client';

import { colors } from "@/config/colors";

export default function ColorShowcase() {
  const colorGroups = [
    {
      title: "Primary Squad 💙",
      colors: [
        { name: "Electric Blueberry", key: "electricBlueberry" },
        { name: "Soft Serve", key: "softServe" },
        { name: "Deep Purple Panda", key: "deepPurplePanda" },
      ],
    },
    {
      title: "Secondary Crew 🧡",
      colors: [
        { name: "Sunny Delight", key: "sunnyDelight" },
        { name: "Butterscotch Dream", key: "butterscotchDream" },
        { name: "Caramel Crush", key: "caramelCrush" },
      ],
    },
    {
      title: "Success Squad 💚",
      colors: [
        { name: "Minty Fresh", key: "mintyFresh" },
        { name: "Limelight", key: "limelight" },
        { name: "Forest Friend", key: "forestFriend" },
      ],
    },
    {
      title: "Warning Team 💛",
      colors: [
        { name: "Banana Bonanza", key: "bananaBonanza" },
        { name: "Golden Glow", key: "goldenGlow" },
        { name: "Honey Buzz", key: "honeyBuzz" },
      ],
    },
    {
      title: "Error Alert ❤️",
      colors: [
        { name: "Strawberry Shock", key: "strawberryShock" },
        { name: "Blush Berry", key: "blushBerry" },
        { name: "Crimson Crisis", key: "crimsonCrisis" },
      ],
    },
    {
      title: "Info Central 💙",
      colors: [
        { name: "Sky Diver", key: "skyDiver" },
        { name: "Ocean Breeze", key: "oceanBreeze" },
        { name: "Deep Dive", key: "deepDive" },
      ],
    },
    {
      title: "Party Mix 🎉",
      colors: [
        { name: "Lavender Latte", key: "lavenderLatte" },
        { name: "Rosy Posy", key: "rosyPosy" },
        { name: "Teal Tango", key: "tealTango" },
        { name: "Grape Juice", key: "grapeJuice" },
      ],
    },
  ];

  return (
    <section className="py-20 px-6 bg-foggy-morning">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-charcoal-champion text-center mb-4">
          Our Colorful Palette 🎨
        </h2>
        <p className="text-center text-storm-cloud mb-12 max-w-2xl mx-auto">
          All colors are centrally managed in <code className="bg-snowflake-surprise px-2 py-1 rounded text-electric-blueberry">src/config/colors.ts</code>
          {' '}with funny, memorable names. Never hardcode colors!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {colorGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="bg-snowflake-surprise rounded-lg p-6 border border-silver-lining">
              <h3 className="text-xl font-bold text-midnight-mystery mb-4">
                {group.title}
              </h3>
              <div className="space-y-3">
                {group.colors.map((color, colorIndex) => (
                  <div key={colorIndex} className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg border border-silver-lining flex-shrink-0"
                      style={{ backgroundColor: colors[color.key as keyof typeof colors] }}
                    />
                    <div>
                      <div className="font-medium text-midnight-mystery">
                        {color.name}
                      </div>
                      <div className="text-sm text-slate-skate font-mono">
                        {colors[color.key as keyof typeof colors]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-snowflake-surprise rounded-lg p-8 border-2 border-electric-blueberry">
          <h3 className="text-2xl font-bold text-midnight-mystery mb-4">
            Usage Examples
          </h3>
          <div className="space-y-4 text-storm-cloud">
            <div>
              <p className="font-semibold text-midnight-mystery mb-2">In Tailwind classes:</p>
              <code className="block bg-foggy-morning p-3 rounded text-sm">
                {`className="bg-electric-blueberry text-snowflake-surprise"`}
              </code>
            </div>
            <div>
              <p className="font-semibold text-midnight-mystery mb-2">Import and use in TypeScript:</p>
              <code className="block bg-foggy-morning p-3 rounded text-sm">
                {`import { colors } from '@/config/colors'`}<br />
                {`style={{ backgroundColor: colors.electricBlueberry }}`}
              </code>
            </div>
            <div>
              <p className="font-semibold text-midnight-mystery mb-2">Semantic aliases in Tailwind:</p>
              <code className="block bg-foggy-morning p-3 rounded text-sm">
                {`className="bg-primary text-text-inverse"`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
