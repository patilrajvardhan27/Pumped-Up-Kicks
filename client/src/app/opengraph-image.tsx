import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';
import { tokenColor } from '@/lib/token-colors';

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const flex = { display: 'flex' } as const;

const blob = (color: string, left: number, top: number) => ({
  ...flex,
  position: 'absolute' as const,
  left,
  top,
  width: 300,
  height: 300,
  borderRadius: 300,
  background: color,
  opacity: 0.35,
});

/** Navy headline on the cloud canvas, beside an answer card backed by the two accent blobs. */
export default function OpengraphImage() {
  const navy = tokenColor('ink-navy');
  const slate = tokenColor('slate-gray');
  const paper = tokenColor('paper');

  return new ImageResponse(
    (
      <div style={{ ...flex, width: '100%', height: '100%', background: tokenColor('cloud'), padding: 72, color: navy }}>
        <div style={{ ...flex, flexDirection: 'column', justifyContent: 'center', width: 600 }}>
          <div style={{ ...flex, fontSize: 28, fontWeight: 700 }}>{site.name}</div>
          <div style={{ ...flex, fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 24 }}>{site.tagline}.</div>
          <div style={{ ...flex, fontSize: 28, color: slate, marginTop: 24, lineHeight: 1.4 }}>
            Every answer links to the second your professor said it.
          </div>
        </div>
        <div style={{ ...flex, position: 'relative', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <div style={blob(tokenColor('coral-magenta'), 10, 40)} />
          <div style={blob(tokenColor('sky-cyan'), 150, 200)} />
          <div
            style={{
              ...flex,
              flexDirection: 'column',
              width: 400,
              padding: 32,
              borderRadius: 16,
              background: paper,
              border: `1px solid ${tokenColor('hairline')}`,
            }}
          >
            <div style={{ ...flex, fontSize: 22, color: slate }}>Why does the gradient vanish?</div>
            <div style={{ ...flex, fontSize: 26, fontWeight: 600, marginTop: 16, lineHeight: 1.4 }}>
              Small derivatives multiply across many layers
            </div>
            <div style={{ ...flex, marginTop: 24 }}>
              <div
                style={{ ...flex, padding: '8px 16px', borderRadius: 8, background: tokenColor('signal-blue'), color: paper, fontSize: 22 }}
              >
                [12:04]
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
