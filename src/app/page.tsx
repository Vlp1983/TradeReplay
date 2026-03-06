"use client";

import { Hero } from "@/components/landing/hero";
import { WhySection } from "@/components/landing/why-section";
import { FeatureSection } from "@/components/landing/feature-section";
import { MockChainCard } from "@/components/landing/mock-chain-card";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <main>
        {/* Section A — Hero */}
        <Hero />

        {/* Section B — Why */}
        <WhySection />

        {/* Section C — AI Backtesting (visual left, copy right) */}
        <FeatureSection
          title="AI Backtesting"
          body="Choose a ticker, pick calls or puts, select a contract from the chain snapshot, and replay how it performed—same day and to expiration. Powered by AI."
          bullets={[
            "Point-in-time contract replay (not strategy guessing)",
            "P/L in $ and % per contract",
            "Key moments with simple explanations",
          ]}
          ctaLabel="Try an example backtest"
          ctaHref="/backtesting"
          visual={<MockChainCard />}
        />

        {/* Section F — Pricing */}
        <PricingSection />

        {/* Section G — FAQ */}
        <FAQSection />
      </main>

      {/* Section H — Footer */}
      <Footer />
    </>
  );
}
