'use client';

import { LazyMotion, MotionConfig } from 'motion/react';
import { DURATION, EASE } from '@/lib/motion';

const loadFeatures = () => import('@/lib/motion-features').then((module) => module.default);

/**
 * Loads Motion's feature set once, after first paint so it stays off the critical
 * path, and applies the brand curve everywhere.
 * reducedMotion="user" turns transform and layout animation off for anyone
 * who has asked their system for less motion.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
