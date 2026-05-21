"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { UserReportStatus } from "@prisma/client"
import { formatDateTime } from "@/utils/formatters"
import { getTraderDisplayName } from "@/utils/user"

import {
  withdrawReportAction,
  type WithdrawReportActionState,
} from "./actions"
import PageWrapper from "@/components/Containers/Pagewrapper/PageWrapper"

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
    <main id="main-content">
      <TitleBanner
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <Link
          href={`/${userSlug}/profile`}
          className="text-sm text-noir-gold-100 underline hover:text-noir-gold"
        >
          {t("backToProfile")}
        </Link>
      </TitleBanner>

      <PageWrapper>
        {state && (
          <div
            className={`mb-6 rounded-md border p-4 ${
              state.success
                ? "border-green-500/50 bg-green-900/20 text-green-300"
                : "border-red-400/50 bg-red-900/20 text-red-300"
            }`}
          >
            {state.message}
          </div>
        )}

        {reports.length === 0 ? (
          <h2 className="py-12 text-center text-noir-gold-100/80">{t("empty")}</h2>
        ) : (
          <ul className="space-y-4">
            {reports.map((report) => {
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
            })}
          </ul>
        )}
      </PageWrapper>
    </main>
  )
}

export default MyReportsPageClient
