"use client"

import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"

import { CSRFTokenProvider } from "@/components/Molecules/CSRFToken"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/quality.webp"

const DataQualityDashboard = dynamic(
  () =>
    import("@/components/Containers/DataQualityDashboard").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse h-64 bg-noir-dark/30 rounded-lg" />
    ),
  }
)

interface DataQualityClientProps {
  isAdmin: boolean
}

const DataQualityClient = ({ isAdmin }: DataQualityClientProps) => {
  const t = useTranslations("dataQuality")

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PageWrapper>
        <CSRFTokenProvider>
          <DataQualityDashboard isAdmin={isAdmin} />
        </CSRFTokenProvider>
      </PageWrapper>
    </main>
  )
}

export { DataQualityClient }
