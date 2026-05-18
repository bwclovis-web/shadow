"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import ViewTabs from "@/components/Organisms/ViewTabs"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { TradeDisputeWithRelations } from "@/models/trade-dispute.server"
import type { UserReportWithRelations } from "@/models/user-report.server"

import ProfileReportsTab from "./ProfileReportsTab"
import TradeDisputesTab from "./TradeDisputesTab"

const BANNER_IMAGE = "/images/complaints.png"

type DisputesTab = "trade" | "profile"

type DisputesAdminClientProps = {
  disputes: TradeDisputeWithRelations[]
  reports: UserReportWithRelations[]
}

const DisputesAdminClient = ({
  disputes,
  reports,
}: DisputesAdminClientProps) => {
  const t = useTranslations("adminDisputes")
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTab: DisputesTab =
    searchParams.get("tab") === "profile" ? "profile" : "trade"

  const setActiveTab = useCallback(
    (tab: DisputesTab) => {
      const next = new URLSearchParams(searchParams.toString())
      if (tab === "trade") {
        next.delete("tab")
      } else {
        next.set("tab", "profile")
      }
      const qs = next.toString()
      router.replace(`/admin/disputes${qs ? `?${qs}` : ""}`, { scroll: false })
    },
    [router, searchParams]
  )

  return (
    <div>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ViewTabs<DisputesTab>
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel={t("tabs.ariaLabel")}
          tabs={[
            {
              id: "trade",
              label: t("tabs.tradeDisputes"),
              panel: <TradeDisputesTab disputes={disputes} />,
            },
            {
              id: "profile",
              label: t("tabs.profileReports"),
              panel: <ProfileReportsTab reports={reports} />,
            },
          ]}
        />
      </div>
    </div>
  )
}

export default DisputesAdminClient
