import { Suspense } from 'react'
import { AuthModalAutoOpen } from '@/components/auth/AuthModalAutoOpen'

function SignInContent() {
  return (
    <main className="min-h-screen bg-[#0B1220] flex items-center justify-center">
      <AuthModalAutoOpen />
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B1220]" />}>
      <SignInContent />
    </Suspense>
  )
}
