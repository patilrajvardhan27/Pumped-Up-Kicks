/**
 * Palette: a tape deck in a dim lecture hall.
 *
 * Cool slate-blue panels (never pure black), warm amber for anything that
 * signals activity, phosphor green reserved for "live / ready" readouts only.
 * Keeping amber and phosphor rare is what makes them read as signal.
 */
export const colors = {
  // Ground and panels
  inkStamp: '#080E14',
  tapeDeck: '#0F1A24',
  reelRoom: '#14222E',
  liftedPanel: '#1B2C3B',
  hairline: '#2E465C',
  hairlineBright: '#3A5670',

  // Type
  chalkTalk: '#E9F0F5',
  lectureHall: '#A7BECF',
  backRow: '#7089A0',
  frontRow: '#FFFFFF',

  // Signal — the VU needle. Primary accent, used sparingly.
  vuNeedle: '#F2A03D',
  warmGlow: '#FFC978',
  emberLow: '#C97C24',

  // Readout — live status only.
  phosphor: '#6EE7A8',
  phosphorDim: '#2F7D5A',

  // Faults
  rustReel: '#E2664A',
  rustDeep: '#8C3620',

  // Secondary accent for cross-references
  magneticBlue: '#63A8E8',
  magneticDeep: '#1E4E7A',
} as const;

export type ColorName = keyof typeof colors;

export const getColor = (colorName: ColorName): string => colors[colorName];

export default colors;
