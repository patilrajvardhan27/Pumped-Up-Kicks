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
        // Semantic roles — reach for these first.
        deck: colors.tapeDeck,
        panel: colors.reelRoom,
        raised: colors.liftedPanel,
        well: colors.inkStamp,
        line: colors.hairline,
        'line-bright': colors.hairlineBright,

        ink: colors.chalkTalk,
        muted: colors.lectureHall,
        faint: colors.backRow,

        signal: {
          DEFAULT: colors.vuNeedle,
          bright: colors.warmGlow,
          low: colors.emberLow,
        },
        live: {
          DEFAULT: colors.phosphor,
          low: colors.phosphorDim,
        },
        fault: {
          DEFAULT: colors.rustReel,
          low: colors.rustDeep,
        },
        cross: {
          DEFAULT: colors.magneticBlue,
          low: colors.magneticDeep,
        },

        // Raw names, for the rare case a component needs a specific hue.
        'tape-deck': colors.tapeDeck,
        'reel-room': colors.reelRoom,
        'lifted-panel': colors.liftedPanel,
        'chalk-talk': colors.chalkTalk,
        'vu-needle': colors.vuNeedle,
        phosphor: colors.phosphor,
        'rust-reel': colors.rustReel,
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // A tight scale — display sizes jump, reading sizes don't.
        'display-xl': ['clamp(3rem, 9vw, 6.5rem)', { lineHeight: '0.92', letterSpacing: '-0.04em' }],
        'display-lg': ['clamp(2.25rem, 5vw, 3.5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.5rem, 3vw, 2rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.18em' }],
      },
      borderRadius: {
        panel: '14px',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 40px -24px rgba(0,0,0,0.9)',
        needle: '0 0 0 1px rgba(242,160,61,0.35), 0 0 22px -4px rgba(242,160,61,0.5)',
      },
      keyframes: {
        'tape-run': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '48px 0' },
        },
        'needle-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'tape-run': 'tape-run 1.4s linear infinite',
        'needle-pulse': 'needle-pulse 1.6s ease-in-out infinite',
        rise: 'rise 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
