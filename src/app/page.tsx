"use client";

import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { WhySection } from "@/components/landing/why-section";
import { FeatureSection } from "@/components/landing/feature-section";
import { MockChainCard } from "@/components/landing/mock-chain-card";
import { MockScoreboard } from "@/components/landing/mock-scoreboard";
import { MockReportCard } from "@/components/landing/mock-report-card";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />

      <main>
        {/* Section A — Hero */}
        <Hero />

        {/* Section B — Why */}
        <WhySection />

        {/* Section C — AI Backtesting (visual left, copy right) */}
        <FeatureSection
          title="AI Backtesting"
          body="Choose a ticker, a past date, and a time-of-day. Select a contract from the chain snapshot and replay how it performed—same day and to expiration. Powered by AI."
          bullets={[
            "Point-in-time contract replay (not strategy guessing)",
            "P/L in $ and % per contract",
            "Key moments with simple explanations",
          ]}
          ctaLabel="Try an example backtest"
          ctaHref="/backtesting"
          visual={<MockChainCard />}
        />

        {/* Section D — Guru Score Board (copy left, visual right = reversed) */}
        <FeatureSection
          title="Guru Score Board"
          body="See which signal providers are consistent across Options, Crypto, and Futures—ranked by performance, risk, and clarity."
          bullets={[
            "Rankings by category and time window",
            "Risk + consistency indicators",
            "Transparent methodology (v1)",
          ]}
          visual={<MockScoreboard />}
          reversed
        />

        {/* Section E — Guru Report Cards (visual left, copy right) */}
        <FeatureSection
          title="Guru Report Cards"
          body="Drill into a signal provider's history and see how alerts performed over time—without relying on opinions or screenshots."
          bullets={[
            "Performance summary (win rate, expectancy, drawdown)",
            "Recent alerts with outcomes",
            "Backtest any alert entry moment",
          ]}
          visual={<MockReportCard />}
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
