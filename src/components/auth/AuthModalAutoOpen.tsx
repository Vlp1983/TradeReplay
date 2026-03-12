'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/lib/auth-context'

export function AuthModalAutoOpen() {
  const [open, setOpen] = useState(true)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user) router.push('/backtesting')
  }, [user, router])

  return (
    <AuthModal
      isOpen={open}
      onClose={() => router.push('/')}
    />
  )
}
