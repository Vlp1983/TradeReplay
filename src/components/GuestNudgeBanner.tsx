'use client'

import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useGate } from '@/lib/use-gate'
import { AuthModal } from '@/components/auth/AuthModal'

export function GuestNudgeBanner() {
  const { user } = useAuth()
  const { backtestCount, isLimitReached } = useGate()
  const [dismissed, setDismissed] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  if (user || dismissed || isLimitReached) return null

  const remaining = Math.max(0, 3 - backtestCount)

  return (
    <>
      <div className="bg-blue-600/10 border-b border-blue-500/20 py-2 px-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-300 flex-1 min-w-0">
            <Zap size={14} className="text-yellow-400 shrink-0" />
            <span className="truncate">
              {backtestCount === 0
                ? 'You have 3 free backtests — no account needed.'
                : `${remaining} free backtest${remaining !== 1 ? 's' : ''} remaining.`
              }
              {' '}
              <button
                onClick={() => setShowAuth(true)}
                className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2 transition-colors"
              >
                Create a free account
              </button>
              {' '}to save progress.
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-white transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        defaultView="signup"
      />
    </>
  )
}
