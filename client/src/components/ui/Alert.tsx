import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './IconButton';
import { CloseIcon } from './icons';

type Tone = 'success' | 'info' | 'danger';

interface AlertProps {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  onClose?: () => void;
}

const TONE: Record<Tone, string> = {
  success: 'bg-accent-green-soft',
  info: 'bg-accent-blue-soft',
  danger: 'bg-accent-red-soft',
};

/** A tinted callout. Errors interrupt the screen reader; the rest wait their turn. */
export function Alert({ children, tone = 'info', title, onClose }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-md py-3 pr-2 pl-4 text-ink', TONE[tone])}
    >
      <div className="min-w-0 flex-1 py-1">
        {title && <p className="text-caption-md">{title}</p>}
        <p className="break-words text-body-xs">{children}</p>
      </div>
      {onClose && (
        <IconButton aria-label="Dismiss" onClick={onClose} className="hover:bg-transparent">
          <CloseIcon />
        </IconButton>
      )}
    </div>
  );
}
