import Link from "next/link";
import Hero from "@/components/Hero";
import Features from "@/components/Features";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Features />

      <footer className="border-t border-line px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-6">
          <p className="max-w-md font-display text-2xl leading-tight text-ink">
            Stop scrubbing. Start asking.
          </p>
          <Link href="/app" className="btn-primary">
            Open the workspace
          </Link>
        </div>
      </footer>
    </main>
  );
}
