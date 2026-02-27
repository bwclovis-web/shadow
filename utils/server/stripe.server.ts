/**
 * Stripe server utilities for subscription checkout and status.
 *
 * Required environment variables (see env.server.ts and .env.example):
 * - STRIPE_SECRET_KEY: Stripe secret key (sk_test_... or sk_live_...). Required for all Stripe API calls.
 * - STRIPE_PUBLISHABLE_KEY: Publishable key for frontend (pk_test_... or pk_live_...).
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret (whsec_...) for verifying webhook events.
 *
 * Optional for createCheckoutSession (subscription):
 * - STRIPE_PRICE_ID: Stripe Price ID for the subscription (price_...). Can be passed as param instead.
 */

import Stripe from "stripe"

let _stripe: Stripe | null = null

const getStripeInstance = (): Stripe => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key?.trim()) {
    throw new Error(
      "STRIPE_SECRET_KEY is required for Stripe operations. Set it in your environment (see .env.example)."
    )
  }
  return new Stripe(key, {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  })
}

/**
 * Returns the Stripe client instance (lazy-initialized). Throws if STRIPE_SECRET_KEY is not set.
 */
export const getStripe = (): Stripe => {
  if (_stripe === null) _stripe = getStripeInstance()
  return _stripe
}

export interface CreateCheckoutSessionParams {
  /** URL to redirect to after successful payment (e.g. /subscribe-success?session_id={CHECKOUT_SESSION_ID}). */
  successUrl: string
  /** URL to redirect to if the customer cancels. */
  cancelUrl: string
  /** Optional Stripe Price ID for the subscription (price_...). Falls back to STRIPE_PRICE_ID env. */
  priceId?: string
  /** Optional customer email to prefill on Checkout. */
  customerEmail?: string
  /** Optional metadata to attach to the session (e.g. redirect path for post-payment flow). */
  metadata?: Record<string, string>
}

/**
 * Creates a Stripe Checkout Session for subscription signup.
 * Uses STRIPE_PRICE_ID from env if priceId is not provided.
 *
 * @returns The created session (includes .url for redirecting the customer to Checkout).
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const priceId = params.priceId ?? process.env.STRIPE_PRICE_ID
  if (!priceId || priceId.trim() === "") {
    throw new Error(
      "Subscription price ID is required. Set STRIPE_PRICE_ID in env or pass priceId to createCheckoutSession."
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    ...(params.customerEmail && { customer_email: params.customerEmail }),
    ...(params.metadata && Object.keys(params.metadata).length > 0 && { metadata: params.metadata }),
  })

  return session
}

export type SubscriptionStatusResult =
  | { status: "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired"; subscription: Stripe.Subscription }
  | { status: "not_found"; subscription: null }

/**
 * Retrieves a Checkout Session by ID (e.g. for subscribe-success or signup verification).
 * Returns null if the session is not found.
 */
export const getCheckoutSession = async (
  sessionId: string
): Promise<Stripe.Checkout.Session | null> => {
  const stripe = getStripe()
  try {
    return await stripe.checkout.sessions.retrieve(sessionId)
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
      return null
    }
    throw err
  }
}

export const getSubscriptionStatus = async (
  subscriptionId: string
): Promise<SubscriptionStatusResult> => {
  const stripe = getStripe()
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const status = subscription.status as Exclude<SubscriptionStatusResult["status"], "not_found">
    return { status, subscription }
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
      return { status: "not_found", subscription: null }
    }
    throw err
  }
}

/**
 * Lists active subscriptions for a Stripe customer ID.
 * Useful for looking up a user's subscription when you have their Stripe customer ID.
 *
 * @param customerId - Stripe customer ID (cus_...).
 * @returns List of subscriptions (typically one for our use case).
 */
export const listSubscriptionsByCustomer = async (
  customerId: string
): Promise<Stripe.Subscription[]> => {
  const stripe = getStripe()
  const { data } = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  })
  return data
}

/**
 * Verifies the Stripe webhook signature and returns the parsed event.
 * Use the raw request body (string) and Stripe-Signature header.
 * Throws if STRIPE_WEBHOOK_SECRET is missing or signature is invalid.
 *
 * @param rawBody - Raw request body as string (do not use parsed JSON).
 * @param signature - Value of the Stripe-Signature header.
 * @returns The verified Stripe event.
 */
export const verifyWebhookPayload = (
  rawBody: string,
  signature: string | null
): Stripe.Event => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret?.trim()) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required for webhook verification. Set it in your environment."
    )
  }
  if (!signature) {
    throw new Error("Missing Stripe-Signature header")
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, secret)
}
