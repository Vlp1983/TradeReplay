"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionWrapper } from "./section-wrapper";

interface FeatureSectionProps {
  title: string;
  body: string;
  bullets: string[];
  ctaLabel?: string;
  ctaHref?: string;
  visual: React.ReactNode;
  reversed?: boolean;
}

export function FeatureSection({
  title,
  body,
  bullets,
  ctaLabel,
  ctaHref,
  visual,
  reversed = false,
}: FeatureSectionProps) {
  return (
    <SectionWrapper>
      <div
        className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
          reversed ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Visual */}
        <div>{visual}</div>

        {/* Copy */}
        <div>
          <h2 className="text-[28px] font-semibold leading-tight text-text-primary md:text-[32px]">
            {title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-secondary">
            {body}
          </p>
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {b}
              </li>
            ))}
          </ul>
          {ctaLabel && ctaHref && (
            <Button variant="outline" className="mt-6" asChild>
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}
