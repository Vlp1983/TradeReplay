'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'

const FREE_BACKTEST_LIMIT = 3
const FREE_SESSION_MINUTES = 10
const STORAGE_KEY = 'tr_guest_usage'

interface GuestUsage {
  sessionId: string
  backtestCount: number
  sessionStartAt: number
}

interface UseGateResult {
  canRunBacktest: boolean
  isLimitReached: boolean
  backtestCount: number
  minutesRemaining: number
  checkAndIncrement: () => boolean
  limitReason: 'backtests' | 'time' | null
}

function getOrCreateGuestUsage(): GuestUsage {
  if (typeof window === 'undefined') return {
    sessionId: crypto.randomUUID(),
    backtestCount: 0,
    sessionStartAt: Date.now(),
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {}
  }

  const fresh: GuestUsage = {
    sessionId: crypto.randomUUID(),
    backtestCount: 0,
    sessionStartAt: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  return fresh
}

export function useGate(): UseGateResult {
  const { user, isPro, backtestCount: userBacktestCount, incrementBacktestCount } = useAuth()
  const [guestUsage, setGuestUsage] = useState<GuestUsage | null>(null)
  const [now, setNow] = useState(Date.now())
  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!user) {
      setGuestUsage(getOrCreateGuestUsage())
    }
  }, [user])

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timerRef.current)
  }, [])

  const isProUser = isPro
  const backtestCount = user ? userBacktestCount : (guestUsage?.backtestCount ?? 0)
  const sessionStartAt = guestUsage?.sessionStartAt ?? Date.now()
  const minutesElapsed = (now - sessionStartAt) / 60_000
  const minutesRemaining = Math.max(0, FREE_SESSION_MINUTES - minutesElapsed)

  const backTestLimitReached = !isProUser && backtestCount >= FREE_BACKTEST_LIMIT
  const timeLimitReached = !user && !isProUser && minutesElapsed >= FREE_SESSION_MINUTES
  const isLimitReached = backTestLimitReached || timeLimitReached
  const canRunBacktest = !isLimitReached

  const limitReason: 'backtests' | 'time' | null = isLimitReached
    ? (backTestLimitReached ? 'backtests' : 'time')
    : null

  const checkAndIncrement = useCallback((): boolean => {
    if (isProUser) return true
    if (isLimitReached) return false

    if (user) {
      incrementBacktestCount()
    } else if (guestUsage) {
      const updated: GuestUsage = {
        ...guestUsage,
        backtestCount: guestUsage.backtestCount + 1,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setGuestUsage(updated)
    }

    return true
  }, [isProUser, isLimitReached, user, guestUsage, incrementBacktestCount])

  return {
    canRunBacktest,
    isLimitReached,
    backtestCount,
    minutesRemaining,
    checkAndIncrement,
    limitReason,
  }
}
