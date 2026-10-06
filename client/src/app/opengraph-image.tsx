import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';
import { tokenColor } from '@/lib/token-colors';

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TICKS = 72;
const ANSWER_AT = 0.513;
const CHIP_WIDTH = 104;

export default function OpengraphImage() {
  const ink = tokenColor('ink');
  const body = tokenColor('body');
  const dark = tokenColor('surface-dark');
  const primary = tokenColor('primary');
  const onPrimary = tokenColor('on-primary');
  const stone = tokenColor('stone');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: tokenColor('canvas'),
          padding: 72,
          color: ink,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1, color: body, display: 'flex' }}>
            LECTURE INTELLIGENCE
          </div>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.1, marginTop: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex' }}>Rewind your lectures,</div>
            <div style={{ display: 'flex' }}>fast-forward your learning.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', position: 'relative', height: 44 }}>
            {/* A fixed-width box centred on the needle (strip x + half the needle). */}
            <div
              style={{
                position: 'absolute',
                left: ANSWER_AT * 1056 + 4 - CHIP_WIDTH / 2,
                top: 0,
                width: CHIP_WIDTH,
                display: 'flex',
                justifyContent: 'center',
                background: primary,
                color: onPrimary,
                fontSize: 26,
                fontWeight: 700,
                padding: '2px 0',
                borderRadius: 4,
              }}
            >
              34:12
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              position: 'relative',
              height: 120,
              background: dark,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
            }}
          >
            {Array.from({ length: TICKS }, (_, i) => (
              <div
                key={i}
                style={{ width: 3, height: i % 6 === 0 ? 64 : 28, background: stone, opacity: 0.5, borderRadius: 2 }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                left: ANSWER_AT * 1056,
                top: 0,
                width: 8,
                height: 120,
                background: primary,
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ marginTop: 20, fontSize: 30, fontWeight: 700, display: 'flex' }}>{site.name}</div>
        </div>
      </div>
    ),
    size,
  );
}
