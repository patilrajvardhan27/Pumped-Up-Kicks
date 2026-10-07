import Link from 'next/link';

/** The product name beside its mark: a dark strip with one lit moment on it. */
export function Wordmark() {
  return (
    <Link href="/" className="group/mark inline-flex min-h-10 items-center gap-2 rounded-sm">
      <span aria-hidden="true" className="relative block h-5 w-7 rounded-sm bg-surface-dark">
        <span className="absolute inset-y-1 left-[58%] w-[3px] rounded-full bg-primary transition-transform group-hover/mark:scale-y-125" />
      </span>
      <span translate="no" className="text-body-strong whitespace-nowrap text-ink">Pumped Up Kicks</span>
    </Link>
  );
}
