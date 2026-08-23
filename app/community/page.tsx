import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import CommunityHubClient from "./CommunityHubClient"
import CommunityPageNav from "./CommunityPageNav"

/** Placeholder hero — swap when a dedicated community asset is ready. */
const BANNER_IMAGE = "/images/new/community.webp"

export const metadata = {
  title: "Community | Shadow",
  description:
    "Collection trays, wear journal, and community challenges — digital collecting only.",
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
        <CommunityPageNav />
        <Suspense fallback={null}>
          <CommunityHubClient signedIn={signedIn} signInHref={signInHref} />
        </Suspense>
      </PageWrapper>
    </main>
  )
}

export default CommunityPage
