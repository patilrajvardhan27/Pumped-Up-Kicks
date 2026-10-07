/*
 * The hero's illustration: one lecture, every place the topic comes up, and
 * the single passage that answers the question. Sample data, not live.
 */
export const RUNTIME_SECONDS = 4000;
export const QUESTION = 'Why does gradient descent stall here?';

export interface Mention {
  seconds: number;
  quote: string;
  answer?: boolean;
}

export const MENTIONS: Mention[] = [
  { seconds: 240, quote: 'Today is optimisation: how a model actually finds its weights.' },
  { seconds: 560, quote: 'Gradient descent just follows the slope downhill, one step at a time.' },
  { seconds: 840, quote: 'On a steep region the gradient is large, so the updates are large.' },
  { seconds: 1320, quote: 'Pick the learning rate too high and the loss bounces around.' },
  { seconds: 1520, quote: 'Here is the loss curve from last week, dropping quickly at first.' },
  { seconds: 1880, quote: 'Notice the curve flattening out. Keep that in mind.' },
  {
    seconds: 2052,
    quote: 'It stalls because this is a saddle point: the gradient is close to zero in every direction.',
    answer: true,
  },
  { seconds: 2440, quote: 'Momentum carries the update through the flat region.' },
  { seconds: 2720, quote: 'Adam adapts the step size for each parameter.' },
  { seconds: 2960, quote: 'A quick aside on why descent can look stuck in a local minimum.' },
  { seconds: 3240, quote: 'In practice you plot the gradient norm to see what is happening.' },
  { seconds: 3560, quote: 'For the assignment, try descent with and without momentum.' },
  { seconds: 3760, quote: 'Next week: regularisation, and why descent alone overfits.' },
];

export const ANSWER_INDEX = MENTIONS.findIndex((mention) => mention.answer);
export const positionOf = (mention: Mention) => mention.seconds / RUNTIME_SECONDS;
export const ANSWER_POSITION = positionOf(MENTIONS[ANSWER_INDEX]);

/** How close the needle must be to a mention to count as on it (share of runtime). */
const REACH = 0.018;

/** The mention under the needle, or null when it is over unrelated material. */
export function mentionAt(position: number): number | null {
  let best: number | null = null;
  let bestDistance = REACH;
  MENTIONS.forEach((mention, index) => {
    const distance = Math.abs(positionOf(mention) - position);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** Deterministic bar heights (20% to 100%) for the waveform backdrop. */
export const WAVEFORM = Array.from({ length: 96 }, (_, index) => {
  const wave = Math.sin(index * 0.9) * 0.3 + Math.sin(index * 0.23 + 1) * 0.35 + Math.sin(index * 2.7) * 0.15;
  return Math.round(20 + ((wave + 0.8) / 1.6) * 80);
});
