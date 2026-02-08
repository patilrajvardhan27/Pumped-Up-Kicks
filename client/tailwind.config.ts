import type { Config } from "tailwindcss";
import colors from "./src/config/colors";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary palette
        primary: {
          DEFAULT: colors.electricBlueberry,
          light: colors.softServe,
          dark: colors.deepPurplePanda,
        },
        secondary: {
          DEFAULT: colors.sunnyDelight,
          light: colors.butterscotchDream,
          dark: colors.caramelCrush,
        },

        // Neutrals
        white: colors.snowflakeSurprise,
        background: {
          DEFAULT: colors.cloudNine,
          light: colors.snowflakeSurprise,
          dark: colors.foggyMorning,
        },
        border: colors.silverLining,

        // Text colors
        text: {
          primary: colors.midnightMystery,
          secondary: colors.stormCloud,
          disabled: colors.slateSkate,
          heading: colors.charcoalChampion,
          inverse: colors.snowflakeSurprise,
        },

        // Status colors
        success: {
          DEFAULT: colors.mintyFresh,
          light: colors.limelight,
          dark: colors.forestFriend,
        },
        warning: {
          DEFAULT: colors.bananaBonanza,
          light: colors.goldenGlow,
          dark: colors.honeyBuzz,
        },
        error: {
          DEFAULT: colors.strawberryShock,
          light: colors.blushBerry,
          dark: colors.crimsonCrisis,
        },
        info: {
          DEFAULT: colors.skyDiver,
          light: colors.oceanBreeze,
          dark: colors.deepDive,
        },

        // Fun accent colors - use these directly with funny names!
        'electric-blueberry': colors.electricBlueberry,
        'soft-serve': colors.softServe,
        'deep-purple-panda': colors.deepPurplePanda,
        'sunny-delight': colors.sunnyDelight,
        'butterscotch-dream': colors.butterscotchDream,
        'caramel-crush': colors.caramelCrush,
        'snowflake-surprise': colors.snowflakeSurprise,
        'cloud-nine': colors.cloudNine,
        'foggy-morning': colors.foggyMorning,
        'silver-lining': colors.silverLining,
        'slate-skate': colors.slateSkate,
        'storm-cloud': colors.stormCloud,
        'midnight-mystery': colors.midnightMystery,
        'charcoal-champion': colors.charcoalChampion,
        'void-vibes': colors.voidVibes,
        'minty-fresh': colors.mintyFresh,
        'limelight': colors.limelight,
        'forest-friend': colors.forestFriend,
        'banana-bonanza': colors.bananaBonanza,
        'golden-glow': colors.goldenGlow,
        'honey-buzz': colors.honeyBuzz,
        'strawberry-shock': colors.strawberryShock,
        'blush-berry': colors.blushBerry,
        'crimson-crisis': colors.crimsonCrisis,
        'sky-diver': colors.skyDiver,
        'ocean-breeze': colors.oceanBreeze,
        'deep-dive': colors.deepDive,
        'lavender-latte': colors.lavenderLatte,
        'rosy-posy': colors.rosyPosy,
        'teal-tango': colors.tealTango,
        'grape-juice': colors.grapeJuice,
      },
    },
  },
  plugins: [],
};

export default config;
