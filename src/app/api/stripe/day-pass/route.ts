import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const DAY_PASS_PRICE_ID = 'price_1T8j1ZRzoQ86WEJxulFB2p7c'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? '',
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: DAY_PASS_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/backtesting?day_pass=success`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { supabase_user_id: user.id, type: 'day_pass' },
    })

    // Set day_pass_expires_at to 24 hours from now using service client
    const serviceClient = createServiceClient()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await serviceClient
      .from('profiles')
      .update({ day_pass_expires_at: expiresAt } as Record<string, unknown>)
      .eq('id', user.id)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Day pass checkout error:', error)
    return NextResponse.json({ error: 'Failed to create day pass session' }, { status: 500 })
  }
}
