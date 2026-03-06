"use client";

import { PricingSection } from "@/components/landing/pricing-section";
import { Footer } from "@/components/landing/footer";

export default function PricingPage() {
  return (
    <>
      <main className="min-h-screen pt-[72px]">
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
