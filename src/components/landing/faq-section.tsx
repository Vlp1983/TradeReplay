"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionWrapper } from "./section-wrapper";

const faqs = [
  {
    q: "Is this investment advice?",
    a: "No. TradeReplay is for educational and analytical purposes only. We do not provide investment advice, recommendations, or solicitations to buy or sell any securities.",
  },
  {
    q: "Do I need a brokerage connection?",
    a: "No. TradeReplay does not connect to your brokerage or require any account linking. All analysis is based on historical market data.",
  },
  {
    q: "What markets are supported?",
    a: "Options, Crypto, and Futures. Stocks are intentionally excluded to maintain specialization in complex derivatives markets.",
  },
  {
    q: "How accurate are estimates?",
    a: "For MVP, contract premiums are estimated using a dual-path estimation model (volatility-based and Greeks/momentum-based). Each estimate includes a confidence indicator (High, Medium, or Low) based on model agreement.",
  },
  {
    q: "How does the delayed paywall work?",
    a: "You can use the platform before hitting any paywall. After meaningful usage (e.g., 5 backtests or 3 report cards opened in 14 days), a non-intrusive upgrade prompt appears. Free users retain access to limited backtests and basic features.",
  },
  {
    q: "How are Guru scores calculated?",
    a: "Guru scores are based on accuracy, expectancy, risk discipline, consistency, and clarity. The methodology is transparent and documented. Rankings can be filtered by category and time window.",
  },
];

export function FAQSection() {
  return (
    <SectionWrapper id="faq">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-[28px] font-semibold leading-tight text-text-primary md:text-[32px]">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-[15px]">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[14px] leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionWrapper>
  );
}
