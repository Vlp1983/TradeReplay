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
    q: "What is Options Replay?",
    a: "Options Replay lets you replay how any real options contract performed on a specific past date. Pick a ticker, choose a date, select your strike and expiration \u2014 and see exactly what would have happened. You get real P&L, key price moments, take profit and stop loss analysis, and AI-powered insights into why the trade moved the way it did.",
  },
  {
    q: "Is this real data?",
    a: "Yes. Options Replay is built on real historical market data. Every backtest reflects what actually happened in the market on that day \u2014 real prices, real moves, real outcomes. AI is layered on top to help you understand the why behind the trade.",
  },
  {
    q: "How does the AI analysis work?",
    a: "After each backtest, our AI analyzes the trade using the actual price action, market conditions, and context from that day. It identifies key moments, calculates risk management levels, and tells you what most retail traders realistically would have done \u2014 and whether that would have been a win or a loss. You can also run a Deep Dive filtered through your personal trading strategy.",
  },
  {
    q: "What are the Take Profit and Stop Loss levels?",
    a: "Options Replay calculates multiple TP and SL levels based on standard risk management principles \u2014 1:1, 1:2, and 1:3 risk/reward ratios \u2014 using the actual price data from your backtest. Each level includes an explanation of why it was significant. We also show you what most traders would have done on this trade and label it a realistic win or loss based on common trader behavior patterns.",
  },
  {
    q: "Is this investment advice?",
    a: "No. Options Replay is strictly an educational and analytical tool. It shows you what happened historically \u2014 not what will happen in the future. Nothing on this platform should be construed as investment advice or a recommendation to buy or sell any security.",
  },
  {
    q: "Do I need a brokerage account?",
    a: "No. Options Replay requires no brokerage connection, no API keys, and no account linking. Everything runs on historical data \u2014 you simply pick a ticker, pick a moment in time, and replay it.",
  },
  {
    q: "What is included in the Pro plan?",
    a: "Pro gives you unlimited backtests, full options chain with real Greeks (Delta, Gamma, Theta, Vega, IV Rank), AI-powered Deep Dive analysis with strategy filters, take profit and stop loss analysis, saved favorite tickers, and access to 60 days of historical data. Need just one session? The Day Pass gives you full Pro access for 24 hours at $4.99.",
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
