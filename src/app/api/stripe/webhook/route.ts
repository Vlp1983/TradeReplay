import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID!

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id

        if (!userId) {
          console.error('No supabase_user_id in subscription metadata')
          break
        }

        const item = sub.items.data[0]
        const priceId = item?.price.id
        const plan = priceId === ANNUAL_PRICE_ID ? 'annual' : 'monthly'

        // In Stripe v20, current_period is on the subscription item
        const periodStart = item?.current_period_start
        const periodEnd = item?.current_period_end

        await supabase.from('subscriptions').upsert({
          id: sub.id,
          user_id: userId,
          status: sub.status,
          price_id: priceId ?? '',
          plan,
          current_period_start: periodStart
            ? new Date(periodStart * 1000).toISOString()
            : null,
          current_period_end: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: sub.canceled_at
            ? new Date(sub.canceled_at * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // In Stripe v20, subscription is under parent.subscription_details
        const subId = typeof invoice.parent?.subscription_details?.subscription === 'string'
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id

        if (subId) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', subId)
        }

        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
