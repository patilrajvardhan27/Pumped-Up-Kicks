import { ImageResponse } from 'next/og';
import { tokenColor } from '@/lib/token-colors';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tokenColor('surface-dark'),
        }}
      >
        <div style={{ width: 22, height: 100, borderRadius: 11, background: tokenColor('primary'), display: 'flex' }} />
      </div>
    ),
    size,
  );
}
