'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Subscription } from '@/types/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  subscription: Subscription | null
  isPro: boolean
  isLoading: boolean
  backtestCount: number
  incrementBacktestCount: () => Promise<void>
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  subscription: null,
  isPro: false,
  isLoading: true,
  backtestCount: 0,
  incrementBacktestCount: async () => {},
  refreshUser: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [backtestCount, setBacktestCount] = useState(0)

  const isPro = subscription?.status === 'active' || subscription?.status === 'trialing'

  const fetchUserData = useCallback(async (userId: string) => {
    const [profileResult, subscriptionResult, usageResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('subscriptions').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle(),
      supabase.from('usage_tracking').select('*').eq('user_id', userId).maybeSingle(),
    ])

    if (profileResult.data) setProfile(profileResult.data)
    if (subscriptionResult.data) setSubscription(subscriptionResult.data)
    if (usageResult.data) setBacktestCount(usageResult.data.backtest_count)
  }, [supabase])

  const refreshUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await fetchUserData(user.id)
  }, [supabase, fetchUserData])

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await fetchUserData(session.user.id)
      setIsLoading(false)
    }

    initialize()

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchUserData(session.user.id)
        } else {
          setProfile(null)
          setSubscription(null)
          setBacktestCount(0)
        }
      }
    )

    return () => authSub.unsubscribe()
  }, [supabase, fetchUserData])

  const incrementBacktestCount = useCallback(async () => {
    if (!user) return
    const newCount = backtestCount + 1
    setBacktestCount(newCount)

    const { data: existing } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('usage_tracking')
        .update({
          backtest_count: newCount,
          last_backtest_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('usage_tracking').insert({
        user_id: user.id,
        backtest_count: 1,
        first_backtest_at: new Date().toISOString(),
        last_backtest_at: new Date().toISOString(),
      })
    }
  }, [user, backtestCount, supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setSubscription(null)
    setBacktestCount(0)
  }, [supabase])

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      subscription,
      isPro,
      isLoading,
      backtestCount,
      incrementBacktestCount,
      refreshUser,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
