"use client";

import { Navbar } from "@/components/landing/navbar";
import { FAQSection } from "@/components/landing/faq-section";
import { Footer } from "@/components/landing/footer";

export default function FAQPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-[72px]">
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
