"use client";

import { SectionWrapper } from "./section-wrapper";

export function WhySection() {
  return (
    <SectionWrapper>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[28px] font-semibold leading-tight text-text-primary md:text-[32px]">
          Most traders never review the tape.
        </h2>
        <p className="mt-6 text-base leading-relaxed text-text-secondary">
          Imagine trying to improve in sports without reviewing game
          footage&mdash;no breakdowns, no learning from mistakes, no
          understanding what worked. That&apos;s how most people trade today.
        </p>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          TradeReplay gives you the equivalent of film study for Options:
          replay what happened after a specific entry moment, identify key
          turning points, and learn from every trade.
        </p>
      </div>
    </SectionWrapper>
  );
}
