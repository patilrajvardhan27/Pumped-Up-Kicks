import Hero from "@/components/Hero";
import Features from "@/components/Features";
import ColorShowcase from "@/components/ColorShowcase";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Features />
      <ColorShowcase />
    </main>
  );
}
