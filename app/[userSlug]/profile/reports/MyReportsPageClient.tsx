"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import ProfileListPageLayout from "@/components/Containers/Profile/ProfileListPageLayout"
import type { UserReportStatus } from "@prisma/client"
import { formatDateTime } from "@/utils/formatters"
import { getTraderDisplayName } from "@/utils/user"

import {
  withdrawReportAction,
  type WithdrawReportActionState,
} from "./actions"

export type MyReportRow = {
  id: string
  category: string
  description: string | null
  images: string[]
  status: UserReportStatus
  createdAt: Date
  reportedUser: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
  }
}

type MyReportsPageClientProps = {
  reports: MyReportRow[]
  bannerImage: string
  userSlug: string
}

const MyReportsPageClient = ({
  reports,
  bannerImage,
  userSlug,
}: MyReportsPageClientProps) => {
  const t = useTranslations("myReports")
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    withdrawReportAction,
    null as WithdrawReportActionState
  )

  useEffect(() => {
    if (state?.success) {
      router.refresh()
    }
  }, [state?.success, router])

  return (
    <ProfileListPageLayout
      bannerImage={bannerImage}
      heading={t("heading")}
      subheading={t("subheading")}
      backHref={`/${userSlug}/profile`}
      backLabel={t("backToProfile")}
      items={reports}
      emptyMessage={t("empty")}
      actionState={state}
      renderItem={report => {
        const reportedName = getTraderDisplayName(report.reportedUser)
        const canWithdraw = report.status === "inProgress"

        return (
          <li
            key={report.id}
            className="noir-border rounded-lg bg-noir-dark/10 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-noir-gold-100/70">
                  {formatDateTime(report.createdAt)}
                </p>
                <h3 className="mt-1 text-lg text-noir-gold-100">
                  {t("reported")}:{" "}
                  <Link
                    href={`/trader-profile/${report.reportedUser.id}`}
                    className="text-noir-gold hover:underline"
                  >
                    {reportedName}
                  </Link>
                </h3>
                <p className="mt-1 text-sm">
                  <span className="font-medium text-noir-gold">
                    {t(`categories.${report.category}`)}
                  </span>
                  <span className="mx-2 text-noir-gold-100/50">·</span>
                  <span className="uppercase text-noir-gold-100/70">
                    {t(`status.${report.status}`)}
                  </span>
                </p>
                {report.description && (
                  <p className="mt-2 text-sm text-noir-gold-100/90 whitespace-pre-wrap">
                    {report.description}
                  </p>
                )}
                {report.images.length > 0 && (
                  <ListingPhotos images={report.images} className="mt-3" />
                )}
              </div>

              {canWithdraw && (
                <form action={formAction}>
                  <CSRFToken />
                  <input type="hidden" name="reportId" value={report.id} />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                  >
                    {isPending ? t("withdrawing") : t("withdraw")}
                  </Button>
                </form>
              )}
            </div>
          </li>
        )
      }}
    />
  )
}

export default MyReportsPageClient
