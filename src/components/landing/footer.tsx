import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const productLinks = [
  { label: "AI Backtesting", href: "/backtesting" },
];

const legalLinks = [
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "Disclaimer", href: "#" },
];

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-content">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Product */}
          <div>
            <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-text-muted">
              Product
            </p>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-text-muted">
              Legal
            </p>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-text-muted">
              Contact
            </p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="#"
                  className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <p className="text-[12px] leading-relaxed text-text-muted">
          TradeReplay is for educational and analytical purposes only and does
          not provide investment advice. Past performance is not indicative of
          future results.
        </p>
      </div>
    </footer>
  );
}
