'use client';

import { useId, useState } from 'react';
import { CaretDownIcon, VerifiedIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { Feature } from './content';

/**
 * The feature accordion: the open item reads in navy with a blue icon, the
 * closed ones in mist, each above a hairline. One item is always open.
 */
export function FeatureList({ items }: { items: Feature[] }) {
  const [open, setOpen] = useState(0);
  const baseId = useId();

  return (
    <ul className="flex flex-col">
      {items.map((item, index) => {
        const active = index === open;
        const panelId = `${baseId}-${index}`;
        return (
          <li key={item.title} className="border-b border-hairline">
            <button
              type="button"
              aria-expanded={active}
              aria-controls={panelId}
              onClick={() => setOpen(index)}
              className="flex w-full items-center gap-3 rounded-md py-4 text-left"
            >
              <VerifiedIcon className={cn('size-5', active ? 'text-signal-blue' : 'text-slate-gray')} />
              <span className={cn('flex-1', active ? 'text-title-sm text-ink-navy' : 'text-body text-slate-gray')}>
                {item.title}
              </span>
              <CaretDownIcon className={cn('transition-transform', active ? 'rotate-180 text-ink-navy' : 'text-slate-gray')} />
            </button>
            <p id={panelId} hidden={!active} className="measure-narrow pb-4 pl-8 text-body text-slate-gray">
              {item.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
