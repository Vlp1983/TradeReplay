"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  LogOut,
  Pencil,
  Save,
  Zap,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    profile,
    subscription,
    isPro,
    isDayPass,
    isLoading,
    backtestCount,
    signOut,
    refreshUser,
  } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isCheckoutSuccess = searchParams.get("checkout") === "success";

  useEffect(() => {
    if (isCheckoutSuccess) {
      setShowSuccess(true);
      refreshUser();
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isCheckoutSuccess, refreshUser]);

  useEffect(() => {
    if (profile?.full_name) {
      setDisplayName(profile.full_name);
    }
  }, [profile?.full_name]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </main>
    );
  }

  // Plan info
  const hasSub = subscription?.status === "active" || subscription?.status === "trialing";
  const planLabel = hasSub
    ? subscription?.plan === "annual"
      ? "Pro Annual"
      : "Pro Monthly"
    : isDayPass
      ? "Day Pass"
      : "Free";

  const dayPassExpiry = profile?.day_pass_expires_at
    ? new Date(profile.day_pass_expires_at)
    : null;
  const dayPassActive = dayPassExpiry && dayPassExpiry > new Date();

  const nextBilling = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPortalLoading(false);
    }
  }

  async function handleSaveName() {
    if (!user || !displayName.trim()) return;
    setSavingName(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ full_name: displayName.trim() })
        .eq("id", user.id);
      setEditingName(false);
      refreshUser();
    } finally {
      setSavingName(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <main className="min-h-screen px-4 pb-16 pt-[96px] md:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-text-primary">Account</h1>
        </div>

        {/* Success banner */}
        {showSuccess && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-[13px] text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Subscription activated! You now have full Pro access.
          </div>
        )}

        <div className="space-y-6">
          {/* SECTION 1 — Plan Status */}
          <div className="rounded-[14px] border border-border bg-surface p-6">
            <h2 className="mb-4 text-[15px] font-semibold text-text-primary">
              Plan Status
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-muted">Current Plan</span>
                <span className="text-[13px] font-semibold text-text-primary">
                  {planLabel}
                  {planLabel === "Day Pass" && dayPassActive && (
                    <span className="ml-2 text-[11px] font-normal text-text-muted">
                      expires {dayPassExpiry!.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </span>
              </div>

              {nextBilling && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text-muted">
                    Next Billing Date
                  </span>
                  <span className="text-[13px] text-text-primary">
                    {nextBilling}
                  </span>
                </div>
              )}

              {subscription?.cancel_at_period_end && (
                <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-400">
                  Your subscription will cancel at the end of the current billing period.
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {hasSub ? (
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="gap-1.5"
                >
                  {portalLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CreditCard className="h-3.5 w-3.5" />
                  )}
                  Manage Billing
                </Button>
              ) : (
                <>
                  <Button asChild className="gap-1.5">
                    <Link href="/pricing">
                      <Zap className="h-3.5 w-3.5" />
                      Upgrade to Pro
                    </Link>
                  </Button>
                  {!dayPassActive && (
                    <Button variant="outline" asChild className="gap-1.5">
                      <Link href="/pricing">
                        <Clock className="h-3.5 w-3.5" />
                        Buy Day Pass
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* SECTION 2 — Usage */}
          <div className="rounded-[14px] border border-border bg-surface p-6">
            <h2 className="mb-4 text-[15px] font-semibold text-text-primary">
              Usage
            </h2>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-text-muted">
                Backtests Run
              </span>
              <span className="text-[13px] font-semibold text-text-primary">
                {isPro ? (
                  "Unlimited"
                ) : (
                  `${backtestCount} / 3`
                )}
              </span>
            </div>

            {!isPro && (
              <div className="mt-2">
                <div className="h-2 w-full rounded-full bg-border">
                  <div
                    className="h-2 rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min((backtestCount / 3) * 100, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-text-muted">
                  {backtestCount >= 3
                    ? "Free limit reached. Upgrade for unlimited backtests."
                    : `${3 - backtestCount} free backtest${3 - backtestCount === 1 ? "" : "s"} remaining.`}
                </p>
              </div>
            )}
          </div>

          {/* SECTION 3 — Account Info */}
          <div className="rounded-[14px] border border-border bg-surface p-6">
            <h2 className="mb-4 text-[15px] font-semibold text-text-primary">
              Account Info
            </h2>

            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-muted">Email</span>
                <span className="text-[13px] text-text-primary">
                  {user?.email ?? "—"}
                </span>
              </div>

              {/* Display Name */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-text-muted">Display Name</span>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-8 w-48 rounded-md border border-border bg-bg px-2 text-[13px] text-text-primary focus:border-accent focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="text-accent hover:text-accent/80"
                    >
                      {savingName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-text-primary">
                      {profile?.full_name || "Not set"}
                    </span>
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-text-muted hover:text-text-primary"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="gap-1.5 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B1220]" />}>
      <AccountContent />
    </Suspense>
  );
}
