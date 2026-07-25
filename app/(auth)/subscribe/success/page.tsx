import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getCheckoutSession } from "@/utils/server/stripe.server"
import { sanitizeRedirectPath } from "@/utils/server/subscribe-redirect.server"
import SubscribeSuccessIntro from "./SubscribeSuccessIntro"
import SubscribeSuccessPanel from "./SubscribeSuccessPanel"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("subscribeSuccess")
  return {
    title: t("title"),
    description: t("description"),
  }
}

type PageProps = {
  searchParams: Promise<{
    session_id?: string
    redirect?: string
  }>
}

const buildContinueHref = (
  redirectPath: string,
  sessionId: string,
  email: string
): string => {
  const url = new URL(redirectPath, "http://localhost")
  url.searchParams.set("session_id", sessionId)
  url.searchParams.set("email", email)
  return `${url.pathname}${url.search}`
}

const SubscribeSuccessPage = async ({ searchParams }: PageProps) => {
  const params = await searchParams
  const sessionId = params.session_id?.trim() || null
  const redirectPath = sanitizeRedirectPath(params.redirect)

  let verified = false
  let signUpHref: string | null = null
  let email = ""

  if (sessionId) {
    try {
      const session = await getCheckoutSession(sessionId)
      const sessionEmail =
        (session?.customer_details?.email as string | undefined) ||
        (session?.customer_email as string | undefined) ||
        ""
      if (session?.status === "complete" && sessionEmail) {
        verified = true
        email = sessionEmail
        signUpHref = buildContinueHref(redirectPath, sessionId, email)
      }
    } catch (err) {
      console.error("Subscribe success session lookup failed:", err)
    }
  }

  const subscribeHref = `/subscribe?redirect=${encodeURIComponent(redirectPath)}`

  return (
    <section
      aria-labelledby="subscribe-success-heading"
      className="grid w-full grid-cols-1 items-start gap-6 md:gap-8 lg:grid-cols-2 lg:items-center"
    >
      <SubscribeSuccessIntro verified={verified} />
      <div className="w-full min-w-0">
        <SubscribeSuccessPanel
          verified={verified}
          signUpHref={signUpHref}
          subscribeHref={subscribeHref}
        />
      </div>
    </section>
  )
}

export default SubscribeSuccessPage
