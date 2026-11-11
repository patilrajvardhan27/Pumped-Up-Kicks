import { cn } from '@/lib/cn';
import { ProductCard } from './ProductStage';

const MOMENTS = ['3:10', '7:59', '12:04', '18:40', '24:15', '31:02', '38:27', '45:50', '52:13'];
const SELECTED = '12:04';
const CITED = ['12:04', '13:20', '18:40'];

/**
 * A static preview of the workspace, laid out like the product: the lecture,
 * its moments with the cited one selected, and the answer with its timestamps.
 */
export function AnswerCard() {
  return (
    <ProductCard className="grid text-left sm:grid-cols-[0.9fr_1fr_1.3fr]">
      <div className="flex flex-col gap-3 border-b border-pebble p-6 sm:border-r sm:border-b-0">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-ink-navy text-label text-paper">
          CS
        </span>
        <p className="text-caption text-slate-gray">Deep Learning</p>
        <p className="text-title-sm text-ink-navy">Lecture 7: Training deep networks</p>
        <p className="text-caption text-slate-gray tabular-nums">58:12 · transcribed</p>
      </div>

      <div className="flex flex-col gap-3 border-b border-pebble p-6 sm:border-r sm:border-b-0">
        <p className="text-label text-ink-navy">Moments</p>
        <ul className="grid grid-cols-3 gap-2">
          {MOMENTS.map((moment) => (
            <li
              key={moment}
              className={cn(
                'flex h-9 items-center justify-center rounded-full text-caption tabular-nums',
                moment === SELECTED ? 'bg-signal-blue text-paper' : 'bg-blue-wash text-deep-cobalt',
              )}
            >
              {moment}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 p-6">
        <p className="text-caption text-slate-gray">Why does the gradient vanish?</p>
        <p className="text-body-sm text-ink-navy">
          Each layer multiplies the gradient by a small derivative, so across many layers it shrinks towards zero
          before reaching the first ones.
        </p>
        <ul className="flex flex-wrap gap-2">
          {CITED.map((time, index) => (
            <li
              key={time}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-label tabular-nums',
                index === 0 ? 'border-signal-blue bg-signal-blue text-paper' : 'border-hairline text-ink-navy',
              )}
            >
              {time}
            </li>
          ))}
        </ul>
      </div>
    </ProductCard>
  );
}
