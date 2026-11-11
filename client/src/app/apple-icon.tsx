import { ImageResponse } from 'next/og';
import { tokenColor } from '@/lib/token-colors';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const bar = { display: 'flex', position: 'absolute' as const, borderRadius: 8 };

/** The wordmark tile: a navy square with a blue playhead on a timeline. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', background: tokenColor('ink-navy') }}>
        <div style={{ ...bar, left: 30, right: 30, top: 86, height: 8, background: tokenColor('mist-gray') }} />
        <div style={{ ...bar, left: 100, top: 40, width: 18, height: 100, background: tokenColor('signal-blue') }} />
      </div>
    ),
    size,
  );
}
