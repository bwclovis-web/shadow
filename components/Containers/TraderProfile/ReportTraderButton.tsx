"use client"

import { useTranslations } from "next-intl"

import ReportTraderModal from "@/components/Containers/Forms/ReportTraderModal"
import TraderActionButton from "@/components/Containers/TraderProfile/TraderActionButton"

type ReportTraderButtonProps = {
  traderId: string
  trader: {
    id: string
    firstName?: string | null
    lastName?: string | null
    username?: string | null
    email?: string
  }
  viewerId?: string | null
  size?: "sm" | "md"
}

const ReportTraderButton = ({
  traderId,
  trader,
  viewerId,
  size = "md",
}: ReportTraderButtonProps) => {
  const t = useTranslations("userReport")

  return (
    <TraderActionButton
      traderId={traderId}
      trader={trader}
      viewerId={viewerId}
      label={t("button")}
      modalId="report-trader"
      variant="secondary"
      background="red"
      size={size}
      renderModal={({ traderId: reportedUserId, traderName, closeModal }) => (
        <ReportTraderModal
          reportedUserId={reportedUserId}
          traderName={traderName}
          onSuccess={() => {
            setTimeout(() => closeModal(), 1500)
          }}
        />
      )}
    />
  )
}

export default ReportTraderButton
