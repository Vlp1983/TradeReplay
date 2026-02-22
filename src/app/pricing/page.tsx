"use client";

import { Navbar } from "@/components/landing/navbar";
import { PricingSection } from "@/components/landing/pricing-section";
import { Footer } from "@/components/landing/footer";

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-[72px]">
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
