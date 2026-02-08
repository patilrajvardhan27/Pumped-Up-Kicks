import Button from "./Button";
import Link from "next/link";
import ServerStatus from "./ServerStatus";

export default function Hero() {
  return (
    <div className="bg-gradient-to-br from-electric-blueberry via-deep-purple-panda to-grape-juice min-h-screen flex items-center justify-center relative">
      <div className="absolute top-8 right-8">
        <ServerStatus />
      </div>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-snowflake-surprise mb-6">
          Pumped Up Kicks
        </h1>
        <p className="text-xl md:text-2xl text-ocean-breeze mb-8">
          Transform your lectures into interactive learning experiences with AI-powered intelligence
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/app">
            <Button variant="primary" size="lg">
              Get Started
            </Button>
          </Link>
          <a href="#features">
            <Button variant="secondary" size="lg">
              Learn More
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
