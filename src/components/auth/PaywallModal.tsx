'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Zap, Check } from 'lucide-react'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/lib/auth-context'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  reason?: 'backtests' | 'time'
}

export function PaywallModal({ isOpen, onClose, reason = 'backtests' }: PaywallModalProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  if (!isOpen) return null

  const monthlyPrice = '$15.99'
  const annualPrice = '$129.99'
  const annualMonthly = '$10.83'

  if (showAuth) {
    return (
      <AuthModal
        isOpen={true}
        onClose={() => setShowAuth(false)}
        defaultView="signup"
        triggerReason="limit_reached"
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[#0F1A2B] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-[#1E293B] p-6 text-center">
          <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock size={24} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {reason === 'backtests'
              ? "You've used your 3 free backtests"
              : "Your 10-minute free session has ended"
            }
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upgrade to Pro for unlimited backtesting
          </p>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/pricing?plan=monthly')}
            className="group p-4 rounded-xl border border-[#1E293B] hover:border-blue-500/50 bg-white/5 hover:bg-blue-500/5 transition-all text-left"
          >
            <div className="text-slate-400 text-xs font-medium mb-1">Monthly</div>
            <div className="text-2xl font-bold text-white">{monthlyPrice}</div>
            <div className="text-slate-500 text-xs">per month</div>
          </button>

          <button
            onClick={() => router.push('/pricing?plan=annual')}
            className="group p-4 rounded-xl border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/15 transition-all text-left relative"
          >
            <div className="absolute -top-2 right-3 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              Save 32%
            </div>
            <div className="text-blue-400 text-xs font-medium mb-1">Annual</div>
            <div className="text-2xl font-bold text-white">{annualMonthly}</div>
            <div className="text-slate-400 text-xs">/mo &middot; {annualPrice}/yr</div>
          </button>
        </div>

        <div className="px-6 pb-2">
          <ul className="space-y-2">
            {[
              'Unlimited backtests — no limits ever',
              'Full options chain with real Greeks',
              'AI-powered trade insights',
              'Save unlimited favorite tickers',
              '60-day intraday data history',
            ].map(feature => (
              <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                <Check size={14} className="text-green-400 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={() => router.push('/pricing')}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Zap size={16} className="text-yellow-300" />
            Upgrade to Pro
          </button>

          {!user && (
            <button
              onClick={() => setShowAuth(true)}
              className="w-full py-3 rounded-xl border border-[#1E293B] hover:border-slate-500 text-slate-400 hover:text-white font-medium transition-all text-sm"
            >
              Create free account first
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}

export function PaywallBlur({ isBlurred, onUnlock, children }: {
  isBlurred: boolean
  onUnlock: () => void
  children: React.ReactNode
}) {
  if (!isBlurred) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none select-none" style={{ filter: 'blur(8px)' }}>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          onClick={onUnlock}
          className="bg-[#0F1A2B] border border-blue-500/50 rounded-2xl p-6 text-center shadow-2xl hover:border-blue-400 transition-colors"
        >
          <Lock size={28} className="text-blue-400 mx-auto mb-2" />
          <p className="text-white font-semibold">Results locked</p>
          <p className="text-slate-400 text-sm mt-1">Upgrade to view full analysis</p>
          <div className="mt-3 px-4 py-2 bg-blue-600 rounded-lg text-white text-sm font-medium">
            Unlock Pro &rarr;
          </div>
        </button>
      </div>
    </div>
  )
}
