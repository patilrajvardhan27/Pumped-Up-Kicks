import Link from 'next/link';
import ServerStatus from './ServerStatus';

/**
 * The hero's thesis: an hour of lecture, flattened to a strip, with the two
 * seconds you actually needed lit up on it.
 */

// Positions along the strip, as a percentage of runtime. The lit one is the
// moment the question resolves to.
const MARKS = [6, 14, 21, 33, 38, 47, 52, 61, 68, 74, 81, 89, 94];
const HIT = 52;

export default function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden px-6 py-24">
      <div className="absolute right-6 top-6 z-10">
        <ServerStatus />
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <p className="eyebrow mb-6 animate-rise">Lecture intelligence</p>

        <h1
          className="font-display text-display-xl text-ink animate-rise"
          style={{ animationDelay: '60ms' }}
        >
          Rewind your lectures,
          <br />
          <span className="text-signal">fast-forward</span> your learning.
        </h1>

        <p
          className="mt-8 max-w-xl text-lg leading-relaxed text-muted animate-rise"
          style={{ animationDelay: '140ms' }}
        >
          Upload a recording. Ask it anything. Every answer comes back with the timestamp it was
          drawn from, so you land on the exact moment instead of scrubbing for it.
        </p>

        {/* The strip: one lecture, thirteen moments, one that answers you. */}
        <figure
          className="mt-14 animate-rise"
          style={{ animationDelay: '220ms' }}
          aria-label="A lecture timeline with the moment that answers the question highlighted"
        >
          <figcaption className="mb-3 flex items-baseline justify-between font-mono text-xs">
            <span className="text-muted">&ldquo;why does gradient descent stall here?&rdquo;</span>
            <span className="text-signal">34:12</span>
          </figcaption>

          <div className="relative h-16 rounded-md border border-line bg-well">
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(233,240,245,0.12) 0 1px, transparent 1px 10px)',
              }}
            />

            {MARKS.map((left) => {
              const isHit = left === HIT;
              return (
                <span
                  key={left}
                  className={`absolute -translate-x-1/2 rounded-full ${
                    isHit
                      ? 'top-0 h-full w-[3px] bg-signal shadow-needle'
                      : 'top-1/2 h-6 w-px -translate-y-1/2 bg-muted/40'
                  }`}
                  style={{ left: `${left}%` }}
                />
              );
            })}

          </div>

          <div className="mt-3 flex justify-between font-mono text-[0.65rem] text-faint">
            <span>00:00</span>
            <span>one lecture · 13 places it&rsquo;s mentioned · 1 that answers you</span>
            <span>1:06:40</span>
          </div>
        </figure>

        <div
          className="mt-12 flex flex-wrap items-center gap-4 animate-rise"
          style={{ animationDelay: '300ms' }}
        >
          <Link href="/app" className="btn-primary">
            Open the workspace
          </Link>
          <a href="#how" className="btn-ghost">
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}
