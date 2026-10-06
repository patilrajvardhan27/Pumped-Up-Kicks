import { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  variant?: 'live' | 'signal' | 'fault';
  title?: string;
  onClose?: () => void;
}

export default function Alert({ children, variant = 'signal', title, onClose }: AlertProps) {
  const variants = {
    live: 'border-l-live bg-live/[0.07] text-live',
    signal: 'border-l-signal bg-signal/[0.07] text-signal',
    fault: 'border-l-fault bg-fault/[0.07] text-fault',
  };

  return (
    <div
      role={variant === 'fault' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border border-line border-l-2 p-4 ${variants[variant]}`}
    >
      <div className="min-w-0 flex-1">
        {title && <p className="font-mono text-eyebrow uppercase mb-1">{title}</p>}
        <p className="text-sm text-ink break-words">{children}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 text-faint transition-colors hover:text-ink"
        >
          ✕
        </button>
      )}
    </div>
  );
}
