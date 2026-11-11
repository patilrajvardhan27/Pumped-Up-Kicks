import Link from 'next/link';

/** The product name beside its mark: a navy tile with a blue playhead on a timeline. */
export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg">
      <span aria-hidden="true" className="relative flex size-8 items-center rounded-lg bg-ink-navy px-1.5">
        <span className="h-0.5 w-full rounded-full bg-mist-gray" />
        <span className="absolute top-1.5 bottom-1.5 left-[58%] w-1 rounded-full bg-signal-blue" />
      </span>
      <span translate="no" className="text-title-sm whitespace-nowrap text-ink-navy">
        Pumped Up Kicks
      </span>
    </Link>
  );
}
