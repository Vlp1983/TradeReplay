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
    q: "What tickers are supported?",
    a: "We currently support popular equity options: SPY, QQQ, AAPL, TSLA, NVDA, and AMZN. More tickers and asset classes are coming soon.",
  },
  {
    q: "How accurate are estimates?",
    a: "For MVP, contract premiums are estimated using a dual-path estimation model (volatility-based and Greeks/momentum-based). Each estimate includes a confidence indicator (High, Medium, or Low) based on model agreement.",
  },
  {
    q: "How does the delayed paywall work?",
    a: "You can use the platform before hitting any paywall. After meaningful usage (e.g., 5 backtests in 14 days), a non-intrusive upgrade prompt appears. Free users retain access to limited backtests and basic features.",
  },
  {
    q: "What is the Call/Put selector?",
    a: "Before loading the chain, you choose your directional thesis — Call (bullish) or Put (bearish). This filters the chain snapshot and auto-replays the at-the-money contract in your chosen direction.",
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
