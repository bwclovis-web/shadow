import { getTranslations } from "next-intl/server"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import CommunityHubClient from "./CommunityHubClient"

/** Placeholder hero — swap when a dedicated community asset is ready. */
const BANNER_IMAGE = "/images/new/community.webp"

export const metadata = {
  title: "Community | Shadow",
  description:
    "Collection shelves, wear journal, and community challenges — digital collecting only.",
}

const CommunityPage = async () => {
  const t = await getTranslations("community")
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: false,
  })
  const signedIn = Boolean(session?.userId)
  const signInHref = `/sign-in?redirect=${encodeURIComponent("/community")}`

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("title")}
        subheading={t("subtitle")}
      />
      <PageWrapper>
        <div className="mb-8 flex flex-wrap justify-end gap-3">
          <PrefetchLink
            href="/community/shelves"
            className="text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5 text-noir-gold-100"
          >
            {t("publicShelvesLink")}
          </PrefetchLink>
          <PrefetchLink
            href="/seasonal-planning"
            className="text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5 text-noir-gold-100"
          >
            {t("seasonalPlanningLink")}
          </PrefetchLink>
          <PrefetchLink
            href="/membership"
            className="text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5 text-noir-gold-100"
          >
            {t("membershipCta")}
          </PrefetchLink>
        </div>
        <CommunityHubClient signedIn={signedIn} signInHref={signInHref} />
      </PageWrapper>
    </main>
  )
}

export default CommunityPage
