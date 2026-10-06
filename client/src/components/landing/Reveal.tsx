'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  as?: 'div' | 'ol' | 'ul';
  /** Reveal the direct children one after another instead of the block as a whole. */
  stagger?: boolean;
  className?: string;
}

/**
 * Fades content up as it scrolls into view.
 *
 * The hidden state is applied here, after hydration, and only to content that
 * is still below the fold with motion allowed. Server HTML is always visible,
 * so nothing depends on JavaScript to be readable and nothing flashes.
 */
export function Reveal({ children, as: Tag = 'div', stagger = false, className }: RevealProps) {
  const ref = useRef<HTMLDivElement & HTMLOListElement & HTMLUListElement>(null);
  const attribute = stagger ? 'data-reveal-group' : 'data-reveal';

  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    element.setAttribute(attribute, 'armed');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.setAttribute(attribute, 'shown');
        observer.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      element.removeAttribute(attribute);
    };
  }, [attribute]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
