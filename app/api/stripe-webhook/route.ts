import type Stripe from "stripe"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getUserByEmail } from "@/models/user.query"
import { verifyWebhookPayload } from "@/utils/server/stripe.server"

const STATUS_PAID = "paid" as const
const STATUS_CANCELLED = "cancelled" as const

export async function handleStripeWebhookEvent(
  event: Stripe.Event,
  deps: {
    getUserByEmail: (email: string) => Promise<{ id: string; email: string } | null>
    userUpdate: (args: {
      where: { id: string }
      data: {
        subscriptionStatus: typeof STATUS_PAID
        subscriptionId: string
        subscriptionStartDate: Date
      }
    }) => Promise<unknown>
    userUpdateMany: (args: {
      where: { subscriptionId: string }
      data: Record<string, unknown>
    }) => Promise<{ count: number }>
  }
): Promise<void> {
  const { getUserByEmail: getUser, userUpdate, userUpdateMany } = deps
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const email =
        (session.customer_details?.email as string | undefined) ||
        (session.customer_email as string | undefined)
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id
      if (email && subscriptionId) {
        const user = await getUser(email)
        if (user) {
          await userUpdate({
            where: { id: user.id },
            data: {
              subscriptionStatus: STATUS_PAID,
              subscriptionId,
              subscriptionStartDate: new Date(),
            },
          })
        }
      }
      break
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const isActive = subscription.status === "active" || subscription.status === "past_due"
      const status = isActive ? STATUS_PAID : STATUS_CANCELLED
      await userUpdateMany({
        where: { subscriptionId: subscription.id },
        data: {
          subscriptionStatus: status,
          ...(status === STATUS_CANCELLED && { subscriptionStartDate: null }),
        },
      })
      break
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      await userUpdateMany({
        where: { subscriptionId: subscription.id },
        data: {
          subscriptionStatus: STATUS_CANCELLED,
          subscriptionId: null,
          subscriptionStartDate: null,
        },
      })
      break
    }
    default:
      break
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("Stripe-Signature")
  if (!signature) {
    return new NextResponse("Missing Stripe-Signature header", { status: 401 })
  }
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return new NextResponse("Invalid body", { status: 400 })
  }
  let event: Stripe.Event
  try {
    event = verifyWebhookPayload(rawBody, signature)
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err)
    return new NextResponse("Invalid webhook signature", { status: 400 })
  }
  try {
    await handleStripeWebhookEvent(event, {
      getUserByEmail,
      userUpdate: prisma.user.update.bind(prisma.user),
      userUpdateMany: prisma.user.updateMany.bind(prisma.user),
    })
  } catch (err) {
    console.error("Stripe webhook handler error:", err)
    return new NextResponse("Webhook handler failed", { status: 500 })
  }
  return NextResponse.json({ received: true }, { status: 200 })
}
