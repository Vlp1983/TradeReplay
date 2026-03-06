'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Mail, Lock, User, Zap, ArrowRight, Eye, EyeOff } from 'lucide-react'

type AuthView = 'signin' | 'signup' | 'magic_link' | 'check_email'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultView?: AuthView
  redirectTo?: string
  triggerReason?: 'limit_reached' | 'favorites' | 'general'
}

export function AuthModal({
  isOpen,
  onClose,
  defaultView = 'signin',
  redirectTo,
  triggerReason = 'general',
}: AuthModalProps) {
  const supabase = createClient()
  const [view, setView] = useState<AuthView>(defaultView)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
  const callbackUrl = `${appUrl}/auth/callback${redirectTo ? `?next=${redirectTo}` : ''}`

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
    if (error) setError(error.message)
    setIsLoading(false)
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    })
    if (error) {
      setError(error.message)
    } else {
      setView('check_email')
    }
    setIsLoading(false)
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      onClose()
    }
    setIsLoading(false)
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: callbackUrl,
      },
    })
    if (error) {
      setError(error.message)
    } else {
      setView('check_email')
    }
    setIsLoading(false)
  }

  const limitReachedBanner = triggerReason === 'limit_reached' && (
    <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
      <p className="text-sm text-blue-300 font-medium text-center">
        You&apos;ve used your 3 free backtests
      </p>
      <p className="text-xs text-slate-400 text-center mt-1">
        Sign in or create a free account to continue — then upgrade to Pro for unlimited access.
      </p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#0F1A2B] border border-[#1E293B] rounded-2xl shadow-2xl p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {view === 'check_email' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={28} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-slate-400 text-sm">
              We sent a link to <span className="text-white font-medium">{email}</span>.
              Click it to sign in — no password needed.
            </p>
            <button
              onClick={() => setView('signin')}
              className="mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              &larr; Back to sign in
            </button>
          </div>
        )}

        {view === 'signin' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
            </div>

            {limitReachedBanner}

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[#1E293B] hover:border-slate-500 bg-white/5 hover:bg-white/10 transition-all text-white font-medium mb-4"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#1E293B]" />
              <span className="text-xs text-slate-500">or</span>
              <div className="flex-1 h-px bg-[#1E293B]" />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0B1220] border border-[#1E293B] rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#0B1220] border border-[#1E293B] rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? 'Signing in...' : <>Sign In <ArrowRight size={16} /></>}
              </button>
            </form>

            <button
              onClick={() => setView('magic_link')}
              className="w-full mt-3 py-3 rounded-xl border border-[#1E293B] hover:border-slate-500 text-slate-400 hover:text-white font-medium transition-all text-sm flex items-center justify-center gap-2"
            >
              <Zap size={15} className="text-yellow-400" />
              Sign in with Magic Link
            </button>

            <p className="text-center text-sm text-slate-500 mt-4">
              No account?{' '}
              <button
                onClick={() => setView('signup')}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Create one free
              </button>
            </p>
          </>
        )}

        {view === 'signup' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Create account</h2>
              <p className="text-slate-400 text-sm mt-1">Free — no credit card required</p>
            </div>

            {limitReachedBanner}

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[#1E293B] hover:border-slate-500 bg-white/5 hover:bg-white/10 transition-all text-white font-medium mb-4"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#1E293B]" />
              <span className="text-xs text-slate-500">or</span>
              <div className="flex-1 h-px bg-[#1E293B]" />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSignUp} className="space-y-3">
              <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-[#0B1220] border border-[#1E293B] rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0B1220] border border-[#1E293B] rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-[#0B1220] border border-[#1E293B] rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? 'Creating account...' : <>Create Free Account <ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-center text-xs text-slate-500 mt-4">
              By creating an account you agree to our Terms of Service
            </p>
            <p className="text-center text-sm text-slate-500 mt-3">
              Already have an account?{' '}
              <button
                onClick={() => setView('signin')}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          </>
        )}

        {view === 'magic_link' && (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Zap size={24} className="text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Magic Link</h2>
              <p className="text-slate-400 text-sm mt-1">Get a sign-in link sent to your email</p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleMagicLink} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0B1220] border border-[#1E293B] rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? 'Sending...' : <>Send Magic Link <Zap size={16} /></>}
              </button>
            </form>

            <button
              onClick={() => setView('signin')}
              className="w-full mt-3 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              &larr; Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
