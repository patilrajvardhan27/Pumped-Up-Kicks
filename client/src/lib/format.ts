const pad = (value: number) => value.toString().padStart(2, '0');

/** 724 -> "12:04", 3753 -> "1:02:33". Anything unusable reads as "0:00". */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Sizes keep their unit on the same line as the number. */
export function formatBytes(bytes: number, megabyteDigits = 0): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)}\u00a0GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(megabyteDigits)}\u00a0MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}\u00a0KB`;
}

/** The API bills in US dollars; small amounts need more decimal places. */
export function formatUsd(amount: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export function pluralise(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
