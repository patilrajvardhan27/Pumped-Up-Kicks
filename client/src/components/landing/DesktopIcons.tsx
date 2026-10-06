import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { NavItem } from './nav-data';

interface DesktopIconsProps {
  label: string;
  items: NavItem[];
  className?: string;
}

/** A column of desktop shortcuts. Large screens only; the menu bar covers the rest. */
export function DesktopIcons({ label, items, className }: DesktopIconsProps) {
  return (
    <nav aria-label={label} className={cn('hidden w-24 shrink-0 flex-col gap-2 lg:flex', className)}>
      {items.map(({ href, label: itemLabel, Icon }) => {
        const Anchor = href.startsWith('/') ? Link : 'a';
        return (
          <Anchor
            key={`${href}-${itemLabel}`}
            href={href}
            className="group/icon flex flex-col items-center gap-1.5 rounded-md p-2 text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-lg border border-hairline bg-canvas text-ink transition-transform group-hover/icon:-translate-y-1 group-hover/icon:scale-105 group-active/icon:translate-y-0 group-active/icon:scale-95">
              <Icon className="size-7" />
            </span>
            <span className="rounded-sm px-1 text-caption-sm font-semibold text-ink group-hover/icon:bg-canvas">
              {itemLabel}
            </span>
          </Anchor>
        );
      })}
    </nav>
  );
}
