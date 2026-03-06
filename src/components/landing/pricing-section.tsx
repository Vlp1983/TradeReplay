"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionWrapper } from "./section-wrapper";

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  badge?: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: "default" | "outline";
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    features: [
      "Limited backtests",
      "Basic chain snapshots",
      "Key moments summaries",
    ],
    ctaLabel: "Start Free",
    ctaVariant: "outline",
  },
  {
    name: "Pro",
    price: "$XX",
    period: "/mo",
    badge: "Most Popular",
    features: [
      "Unlimited backtesting",
      "Full Key Moments explanations",
      "AI-powered insights",
    ],
    ctaLabel: "Upgrade to Pro",
    ctaVariant: "default",
  },
  {
    name: "Elite",
    price: "$XXX",
    period: "/mo",
    features: [
      "Everything in Pro",
      "Highest fidelity data (future)",
      "Priority access (future)",
    ],
    ctaLabel: "Upgrade to Elite",
    ctaVariant: "outline",
  },
];

export function PricingSection() {
  return (
    <SectionWrapper id="pricing">
      <div className="text-center">
        <h2 className="text-[28px] font-semibold leading-tight text-text-primary md:text-[32px]">
          Pricing
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          Start free. Upgrade after you&apos;ve used it.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`flex flex-col ${
              tier.badge
                ? "border-accent/40 ring-1 ring-accent/20"
                : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                {tier.badge && (
                  <Badge className="text-[10px]">{tier.badge}</Badge>
                )}
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-text-primary">
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-sm text-text-muted">{tier.period}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="flex-1 space-y-2.5">
                {tier.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.ctaVariant}
                className="mt-6 w-full"
                asChild
              >
                <Link href="/signin">{tier.ctaLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionWrapper>
  );
}
