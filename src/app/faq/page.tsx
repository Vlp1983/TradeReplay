"use client";

import { FAQSection } from "@/components/landing/faq-section";
import { Footer } from "@/components/landing/footer";

export default function FAQPage() {
  return (
    <>
      <main className="min-h-screen pt-[72px]">
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
