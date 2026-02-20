import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeReplay — Options, Crypto & Futures Replay Platform",
  description:
    "Backtest options contracts from any past moment and evaluate signal performance with the Guru Score Board and Guru Report Cards.",
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
