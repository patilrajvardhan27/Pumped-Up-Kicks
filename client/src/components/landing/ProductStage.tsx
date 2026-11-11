import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'magenta' | 'cyan' | 'both';

const BLOB = 'absolute size-56 rounded-full opacity-35 blur-3xl sm:size-72';

/**
 * A product visual on its decorative blobs: soft magenta and cyan shapes
 * offset behind a white card. Atmosphere only, so they are hidden from
 * assistive tech and never carry meaning.
 */
export function ProductStage({ tone = 'both', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative isolate', className)}>
      {tone !== 'cyan' && <span aria-hidden="true" className={cn(BLOB, '-top-8 -left-6 -z-10 bg-coral-magenta')} />}
      {tone !== 'magenta' && <span aria-hidden="true" className={cn(BLOB, '-right-6 -bottom-10 -z-10 bg-sky-cyan')} />}
      {children}
    </div>
  );
}

/** The white product card itself: 16px radius, three-layer blue-tinted shadow. */
export function ProductCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-hairline bg-paper shadow-elevated', className)}>
      {children}
    </div>
  );
}
