import { getTranslations } from "next-intl/server"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { MEMBERSHIP_BENEFITS } from "@/utils/membership/benefits"
import { membershipTierToCheckoutTier } from "@/utils/membership/stripe-prices"

/** Placeholder hero — swap when a dedicated membership asset is ready. */
const BANNER_IMAGE = "/images/new/catalogue.webp"

export const metadata = {
  title: "Membership benefits | Shadow",
  description:
    "Digital Member, Premium, and Collector memberships — $5 / $7 / $10 per year. Browse free; participate with a paid plan.",
}

const MembershipBenefitsPage = async () => {
  const t = await getTranslations("membershipPage")
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
            return (
              <section
                key={key}
                className="noir-border rounded-lg p-5 flex flex-col bg-black/20 text-noir-gold-100"
              >
                <h2 className="text-xl text-noir-gold-500 mb-1">{benefit.label}</h2>
                <p className="text-sm text-noir-gold-500/90 mb-3">
                  {t("pricePerYear", { price: benefit.priceUsd })}
                </p>
                <ul className="space-y-2 text-sm flex-1 mb-6">
                  {benefit.bullets.map(b => (
                    <li key={b} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <PrefetchLink
                  href={href}
                  className="text-center text-sm uppercase tracking-wide border border-noir-gold/40 py-2 rounded hover:bg-white/5"
                >
                  {t("ctaSubscribe")}
                </PrefetchLink>
              </section>
            )
          })}
        </div>
      </PageWrapper>
    </main>
  )
}

export default MembershipBenefitsPage
