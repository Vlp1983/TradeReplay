import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeReplay — Options Replay Platform",
  description:
    "Backtest options contracts from any past moment. Pick calls or puts, replay the contract, and see exactly what would have happened.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
