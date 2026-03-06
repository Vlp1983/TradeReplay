'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { TrendingUp, Menu, X, LogOut, Settings, Zap, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { AuthModal } from '@/components/auth/AuthModal'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, isPro, signOut, isLoading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobile, setShowMobile] = useState(false)

  const navLinks = [
    { href: '/backtesting', label: 'AI Backtesting' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/faq', label: 'FAQ' },
  ]

  const handleSignOut = async () => {
    await signOut()
    setShowUserMenu(false)
    router.push('/')
  }

  const displayName = profile?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Account'

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-[#0B1220]/95 backdrop-blur-md border-b border-[#1E293B]">
        <div className="max-w-[1200px] mx-auto px-4 h-[72px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="text-lg">TradeReplay</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-[#1E293B] animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#1E293B] hover:border-slate-500 bg-white/5 hover:bg-white/10 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {displayName[0].toUpperCase()}
                  </div>
                  <span className="text-white text-sm font-medium">{displayName}</span>
                  {isPro && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                      PRO
                    </span>
                  )}
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-[#0F1A2B] border border-[#1E293B] rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="p-3 border-b border-[#1E293B]">
                        <p className="text-white text-sm font-medium truncate">{user.email}</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {isPro ? 'Pro Plan' : 'Free Plan'}
                        </p>
                      </div>
                      <div className="p-1">
                        <Link
                          href="/account"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 text-sm transition-colors"
                        >
                          <Settings size={15} /> Account Settings
                        </Link>
                        {!isPro && (
                          <Link
                            href="/pricing"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-sm transition-colors"
                          >
                            <Zap size={15} className="text-yellow-400" /> Upgrade to Pro
                          </Link>
                        )}
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                        >
                          <LogOut size={15} /> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowAuth(true)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white font-medium transition-colors"
                >
                  Sign In
                </button>
                <Link
                  href="/pricing"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setShowMobile(!showMobile)}
            className="md:hidden text-slate-400 hover:text-white transition-colors"
          >
            {showMobile ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {showMobile && (
          <div className="md:hidden border-t border-[#1E293B] bg-[#0B1220] px-4 py-4 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setShowMobile(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-[#1E293B] flex flex-col gap-2">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-3 text-slate-400 text-sm"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setShowAuth(true); setShowMobile(false) }}
                    className="px-4 py-3 rounded-xl border border-[#1E293B] text-white text-sm font-medium text-center"
                  >
                    Sign In
                  </button>
                  <Link
                    href="/pricing"
                    onClick={() => setShowMobile(false)}
                    className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold text-center"
                  >
                    Start Free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />
    </>
  )
}
