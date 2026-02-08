export const colors = {
  electricBlueberry: '#4F46E5',
  softServe: '#818CF8',
  deepPurplePanda: '#3730A3',
  sunnyDelight: '#F59E0B',
  butterscotchDream: '#FCD34D',
  caramelCrush: '#D97706',
  snowflakeSurprise: '#FFFFFF',
  cloudNine: '#F9FAFB',
  foggyMorning: '#F3F4F6',
  silverLining: '#E5E7EB',
  slateSkate: '#9CA3AF',
  stormCloud: '#6B7280',
  midnightMystery: '#374151',
  charcoalChampion: '#1F2937',
  voidVibes: '#111827',
  mintyFresh: '#10B981',
  limelight: '#34D399',
  forestFriend: '#059669',
  bananaBonanza: '#FBBF24',
  goldenGlow: '#FDE68A',
  honeyBuzz: '#F59E0B',
  strawberryShock: '#EF4444',
  blushBerry: '#FCA5A5',
  crimsonCrisis: '#DC2626',
  skyDiver: '#3B82F6',
  oceanBreeze: '#93C5FD',
  deepDive: '#2563EB',
  lavenderLatte: '#A78BFA',
  rosyPosy: '#F472B6',
  tealTango: '#14B8A6',
  grapeJuice: '#8B5CF6',
} as const;

export type ColorName = keyof typeof colors;

export const getColor = (colorName: ColorName): string => {
  return colors[colorName];
};

export default colors;
