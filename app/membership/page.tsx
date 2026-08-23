import type { Metadata } from "next"
import type { MembershipTier } from "@prisma/client"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/Atoms/Button"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { prisma } from "@/lib/db"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { MEMBERSHIP_BENEFITS } from "@/utils/membership/benefits"
import { resolveMembershipTier } from "@/utils/membership/entitlements.server"
import { membershipTierToCheckoutTier } from "@/utils/membership/stripe-prices"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { styleMerge } from "@/utils/styleUtils"

/** Placeholder hero — swap when a dedicated membership asset is ready. */
const BANNER_IMAGE = "/images/new/membership.webp"

export const generateMetadata = async (): Promise<Metadata> =>
  buildPageMetadata({
    title: "Membership benefits",
    description:
      "Digital Member, Premium, and Collector memberships — $5 / $7 / $10 per year. Browse free; participate with a paid plan.",
    canonicalPath: "/membership",
    ogImage: BANNER_IMAGE,
  })

const getCurrentMembershipTier = async (): Promise<MembershipTier | null> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: false,
  })
  if (!session?.userId) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { membershipTier: true, subscriptionStatus: true },
  })
  return resolveMembershipTier(user ?? { membershipTier: "free" })
}

const MembershipBenefitsPage = async () => {
  const t = await getTranslations("membershipPage")
  const currentTier = await getCurrentMembershipTier()
  const tiers = [
    { key: "free" as const },
    { key: "premium" as const },
    { key: "collector" as const },
  ]

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PageWrapper>
        <p className="mb-8 text-noir-gold-100/90 max-w-2xl">
          {t("intro")}{" "}
          <PrefetchLink href="/community" className="underline text-noir-gold-500">
            {t("communityLink")}
          </PrefetchLink>
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map(({ key }) => {
            const benefit = MEMBERSHIP_BENEFITS[key]
            const checkoutTier = membershipTierToCheckoutTier(key)
            const href = `/subscribe?tier=${checkoutTier}`
            const isCurrent = currentTier === key
            return (
              <section
                key={key}
                aria-current={isCurrent ? "true" : undefined}
                className={styleMerge(
                  "noir-border rounded-lg p-5 flex flex-col text-noir-gold-100",
                  isCurrent
                    ? "border-noir-gold-500 bg-noir-gold/15 ring-1 ring-noir-gold-500/40"
                    : "bg-black/20"
                )}
              >
                {isCurrent && (
                  <p className="mb-2 text-xs uppercase tracking-wide text-noir-gold-500">
                    {t("currentPlanBadge")}
                  </p>
                )}
                <h2 className="text-xl text-noir-gold-500 mb-1">
                  {t(`tiers.${benefit.translationKey}.label`)}
                </h2>
                <p className="text-sm text-noir-gold-500/90 mb-3">
                  {t("pricePerYear", { price: benefit.priceUsd })}
                </p>
                <ul className="space-y-2 text-sm flex-1 mb-6">
                  {benefit.bullets.map(bulletKey => (
                    <li key={bulletKey} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>
                        {t(`tiers.${benefit.translationKey}.bullets.${bulletKey}`)}
                      </span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled
                      className="w-full max-w-none md:w-full text-sm uppercase tracking-wide"
                    >
                      {t("currentPlanCta")}
                    </Button>
                    <p className="text-center text-xs text-noir-gold-100/70">
                      {t("currentPlanMessage")}
                    </p>
                  </div>
                ) : (
                  <PrefetchLink
                    href={href}
                    className="text-center text-sm uppercase tracking-wide border border-noir-gold/40 py-2 rounded hover:bg-white/5"
                  >
                    {t("ctaSubscribe")}
                  </PrefetchLink>
                )}
              </section>
            )
          })}
        </div>
      </PageWrapper>
    </main>
  )
}

export default MembershipBenefitsPage
