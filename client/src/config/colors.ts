/**
 * Central Color Configuration
 * All colors used throughout the app with funny, memorable names
 * Never hardcode colors in components - always reference these!
 */

export const colors = {
  // Primary colors - The main squeeze
  electricBlueberry: '#4F46E5',      // Vibrant indigo for primary actions
  softServe: '#818CF8',              // Lighter indigo for hover states
  deepPurplePanda: '#3730A3',        // Darker indigo for active states

  // Secondary colors - The backup dancers
  sunnyDelight: '#F59E0B',           // Amber for secondary actions
  butterscotchDream: '#FCD34D',      // Light amber for highlights
  caramelCrush: '#D97706',           // Dark amber for emphasis

  // Neutral colors - The chill squad
  snowflakeSurprise: '#FFFFFF',      // Pure white
  cloudNine: '#F9FAFB',              // Off-white background
  foggyMorning: '#F3F4F6',           // Light gray background
  silverLining: '#E5E7EB',           // Border gray
  slateSkate: '#9CA3AF',             // Medium gray for disabled text
  stormCloud: '#6B7280',             // Dark gray for secondary text
  midnightMystery: '#374151',        // Darker gray for primary text
  charcoalChampion: '#1F2937',       // Almost black for headings
  voidVibes: '#111827',              // Deep black for maximum contrast

  // Success colors - The winners
  mintyFresh: '#10B981',             // Success green
  limelight: '#34D399',              // Light success green
  forestFriend: '#059669',           // Dark success green

  // Warning colors - The heads-up crew
  bananaBonanza: '#FBBF24',          // Warning yellow
  goldenGlow: '#FDE68A',             // Light warning yellow
  honeyBuzz: '#F59E0B',              // Dark warning orange

  // Error colors - The oops squad
  strawberryShock: '#EF4444',        // Error red
  blushBerry: '#FCA5A5',             // Light error red
  crimsonCrisis: '#DC2626',          // Dark error red

  // Info colors - The knowledge nuggets
  skyDiver: '#3B82F6',               // Info blue
  oceanBreeze: '#93C5FD',            // Light info blue
  deepDive: '#2563EB',               // Dark info blue

  // Special colors - The party mix
  lavenderLatte: '#A78BFA',          // Purple accent
  rosyPosy: '#F472B6',               // Pink accent
  tealTango: '#14B8A6',              // Teal accent
  grapeJuice: '#8B5CF6',             // Vibrant purple
} as const;

export type ColorName = keyof typeof colors;

// Helper function to get color value
export const getColor = (colorName: ColorName): string => {
  return colors[colorName];
};

// Export for Tailwind config
export default colors;
