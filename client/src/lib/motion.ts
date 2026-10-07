/*
 * Motion (the animation library) takes numbers, not CSS variables, so the
 * brand curve and speeds from styles/tokens.css are mirrored here once.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = { fast: 0.15, base: 0.25, slow: 0.4 } as const;

/** A quick, slightly firm settle for things the user has just let go of. */
export const SNAP_SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;
