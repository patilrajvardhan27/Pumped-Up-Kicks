import { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  onClose?: () => void;
}

export default function Alert({ children, variant = 'info', title, onClose }: AlertProps) {
  const variants = {
    success: {
      bg: 'bg-limelight',
      border: 'border-minty-fresh',
      text: 'text-forest-friend',
      icon: '✅',
    },
    warning: {
      bg: 'bg-golden-glow',
      border: 'border-banana-bonanza',
      text: 'text-honey-buzz',
      icon: '⚠️',
    },
    error: {
      bg: 'bg-blush-berry',
      border: 'border-strawberry-shock',
      text: 'text-crimson-crisis',
      icon: '❌',
    },
    info: {
      bg: 'bg-ocean-breeze',
      border: 'border-sky-diver',
      text: 'text-deep-dive',
      icon: 'ℹ️',
    },
  };

  const style = variants[variant];

  return (
    <div className={`${style.bg} ${style.border} border-l-4 p-4 rounded relative`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 text-xl mr-3">{style.icon}</div>
        <div className="flex-1">
          {title && (
            <h4 className={`font-semibold ${style.text} mb-1`}>{title}</h4>
          )}
          <p className={style.text}>{children}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`${style.text} hover:opacity-70 transition-opacity ml-3`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
