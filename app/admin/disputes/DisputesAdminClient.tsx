"use client"

import { useTranslations } from "next-intl"

import TabContainer from "@/components/Organisms/Tabs/Tabs/TabContainer"
import TabItem from "@/components/Organisms/Tabs/Tabs/TabItem/TabItem"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { TradeDisputeWithRelations } from "@/models/trade-dispute.server"
import type { UserReportWithRelations } from "@/models/user-report.server"

import ProfileReportsTab from "./ProfileReportsTab"
import TradeDisputesTab from "./TradeDisputesTab"

const BANNER_IMAGE = "/images/complaints.png"

type DisputesAdminClientProps = {
  disputes: TradeDisputeWithRelations[]
  reports: UserReportWithRelations[]
  defaultTab?: "trade" | "profile"
}

const DisputesAdminClient = ({
  disputes,
  reports,
  defaultTab = "trade",
}: DisputesAdminClientProps) => {
  const t = useTranslations("adminDisputes")

  return (
    <div>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TabContainer type="default" size="md" defaultActiveTab={defaultTab === "profile" ? 1 : 0}>
          <TabItem
            label={t("tabs.tradeDisputes")}
            content={<TradeDisputesTab disputes={disputes} />}
          />
          <TabItem
            label={t("tabs.profileReports")}
            content={<ProfileReportsTab reports={reports} />}
          />
        </TabContainer>
      </div>
    </div>
  )
}

export default DisputesAdminClient
