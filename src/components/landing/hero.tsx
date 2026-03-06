"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MockPreviewCard } from "./mock-preview-card";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-32 md:px-6 md:pb-24 md:pt-40">
      <div className="mx-auto grid max-w-content items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Badge variant="outline" className="mb-6 text-[13px] font-normal">
            Options Backtesting
          </Badge>

          <h1 className="text-[38px] font-bold leading-tight text-text-primary md:text-[56px]">
            Replay any trade.
            <br />
            See the result.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-text-secondary md:text-lg">
            AI-powered backtesting for options. Pick a moment, choose calls or
            puts, replay the contract, and see exactly what would have happened.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/backtesting">Start Backtesting</Link>
            </Button>
          </div>

          <p className="mt-5 text-[13px] text-text-muted">
            Powered by AI &bull; No brokerage connection required &bull;
            Educational analysis only
          </p>
        </motion.div>

        {/* Right product preview */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
        >
          <MockPreviewCard />
        </motion.div>
      </div>
    </section>
  );
}
