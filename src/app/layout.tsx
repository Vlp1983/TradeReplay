import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navbar } from "@/components/Navbar";
import { GuestNudgeBanner } from "@/components/GuestNudgeBanner";

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
      <body>
        <AuthProvider>
          <Navbar />
          <GuestNudgeBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
