"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { DisputeCategory, DisputeResolutionOutcome, DisputeStatus } from "@prisma/client"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { formatDateTime } from "@/utils/formatters"
import { getTraderDisplayName } from "@/utils/user"

import {
  withdrawDisputeAction,
  type WithdrawDisputeActionState,
} from "./actions"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import { VooDooLink } from "@/components/Atoms/Button"

export type MyDisputeRow = {
  id: string
  category: DisputeCategory
  description: string | null
  images: string[]
  status: DisputeStatus
  resolutionOutcome: DisputeResolutionOutcome | null
  initiatedByUserId: string
  createdAt: Date
  trade: { id: string; status: string }
  initiatedBy: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
  }
  otherParty: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
  }
}

type MyDisputesPageClientProps = {
  disputes: MyDisputeRow[]
  bannerImage: string
  userSlug: string
  currentUserId: string
}

const MyDisputesPageClient = ({
  disputes,
  bannerImage,
  userSlug,
  currentUserId,
}: MyDisputesPageClientProps) => {
  const t = useTranslations("myDisputes")
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    withdrawDisputeAction,
    null as WithdrawDisputeActionState
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
        <VooDooLink
          url={`/${userSlug}/profile`}
          variant="link"
          size="sm"
          prefetch
          transitionVariant="detail-to-list"
        >
          {t("backToProfile")}
        </VooDooLink>
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

        {disputes.length === 0 ? (
          <h2 className="py-12 text-center text-noir-gold-100/80">{t("empty")}</h2>
        ) : (
          <ul className="space-y-4">
            {disputes.map((dispute) => {
              const counterparty =
                dispute.initiatedByUserId === currentUserId
                  ? dispute.otherParty
                  : dispute.initiatedBy
              const counterpartyName = getTraderDisplayName(counterparty)
              const canWithdraw =
                dispute.status === "open" &&
                dispute.initiatedByUserId === currentUserId

              return (
                <li
                  key={dispute.id}
                  className="noir-border rounded-lg bg-noir-dark/10 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-noir-gold-100/70">
                        {formatDateTime(dispute.createdAt)}
                      </p>
                      <h3 className="mt-1 text-lg text-noir-gold-100">
                        {t("otherParty")}:{" "}
                        <Link
                          href={`/trader-profile/${counterparty.id}`}
                          className="text-noir-gold hover:underline"
                        >
                          {counterpartyName}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-noir-gold-100/80">
                        {t("tradeStatus")}: {dispute.trade.status}
                      </p>
                      <p className="mt-1 text-sm">
                        <span className="font-medium text-noir-gold">
                          {t(`categories.${dispute.category}`)}
                        </span>
                        <span className="mx-2 text-noir-gold-100/50">·</span>
                        <span className="uppercase text-noir-gold-100/70">
                          {t(`status.${dispute.status}`)}
                        </span>
                        {dispute.resolutionOutcome ? (
                          <span className="ml-2 text-noir-gold-100/70">
                            ({t(`outcomes.${dispute.resolutionOutcome}`)})
                          </span>
                        ) : null}
                      </p>
                      {dispute.description ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-noir-gold-100/90">
                          {dispute.description}
                        </p>
                      ) : null}
                      {dispute.images.length > 0 ? (
                        <ListingPhotos images={dispute.images} className="mt-3" />
                      ) : null}
                    </div>

                    {canWithdraw ? (
                      <form action={formAction}>
                        <CSRFToken />
                        <input type="hidden" name="disputeId" value={dispute.id} />
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          disabled={isPending}
                        >
                          {isPending ? t("withdrawing") : t("withdraw")}
                        </Button>
                      </form>
                    ) : null}
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

export default MyDisputesPageClient
