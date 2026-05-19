"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import { useCSRF } from "@/hooks/useCSRF"
import type { DecantSplitForClient } from "@/types/decant-split"
import { getProfilePathForUser } from "@/utils/user"

type DecantSplitClientProps = {
  initialSplit: DecantSplitForClient
  viewerId: string | null
}

const DecantSplitClient = ({ initialSplit, viewerId }: DecantSplitClientProps) => {
  const t = useTranslations("decantSplits.detail")
  const router = useRouter()
  const { addToFormData } = useCSRF()
  const [split, setSplit] = useState(initialSplit)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const postAction = useCallback(
    async (url: string, fields?: Record<string, string>) => {
      setBusy(true)
      setError(null)
      try {
        const formData = new FormData()
        if (fields) {
          for (const [k, v] of Object.entries(fields)) {
            formData.append(k, v)
          }
        }
        addToFormData(formData)
        const res = await fetch(url, {
          method: "POST",
          body: formData,
          credentials: "include",
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error ?? t("actionFailed"))
          return
        }
        setSplit(data.split)
        router.refresh()
      } catch {
        setError(t("actionFailed"))
      } finally {
        setBusy(false)
      }
    },
    [addToFormData, router, t]
  )

  const hostPath = getProfilePathForUser({
    id: split.hostUserId,
    username: split.hostUsername,
    profileSlug: split.hostProfileSlug,
  })

  return (
    <article className="inner-container py-10 space-y-8">
      <div className="rounded-lg border border-noir-gold/40 bg-noir-dark/80 p-6 space-y-4">
        <p className="text-sm text-amber-200/90 border border-amber-500/30 rounded-md p-3 bg-amber-950/30">
          {t("disclaimer")}
        </p>

        <div className="flex flex-col md:flex-row gap-6">
          {split.perfumeImage && (
            <Image
              src={split.perfumeImage}
              alt=""
              width={160}
              height={160}
              className="rounded-lg object-cover"
            />
          )}
          <div className="space-y-2 flex-1">
            <h1 className="text-2xl text-noir-gold">{split.perfumeName}</h1>
            <p className="text-noir-gold-100">
              {t("hostedBy")}{" "}
              <Link href={hostPath} className="underline text-noir-gold">
                {split.hostUsername}
              </Link>
            </p>
            <p className="text-sm text-noir-gold-300">
              {t("status", { status: split.status })} · {split.totalMl} ml ·{" "}
              {t("openSlots", {
                count: split.slots.filter(s => s.status === "open").length,
              })}
            </p>
            {split.priceHint && (
              <p className="text-sm text-noir-gold-100">
                {t("priceHint", { hint: split.priceHint })}
              </p>
            )}
            {split.notes && (
              <p className="text-sm text-noir-light whitespace-pre-wrap">{split.notes}</p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {split.viewerIsHost && ["open", "filling"].includes(split.status) && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy || split.slots.some(s => s.status === "open")}
              onClick={() => void postAction(`/api/decant-splits/${split.id}/ship`)}
            >
              {t("markShipped")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || split.slots.some(s => s.status !== "open")}
              onClick={() => void postAction(`/api/decant-splits/${split.id}/cancel`)}
            >
              {t("cancelSplit")}
            </Button>
          </div>
        )}
      </div>

      <section>
        <h2 className="text-xl text-noir-gold mb-4">{t("slotsTitle")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {split.slots.map(slot => {
            const isMine = slot.claimantUserId === viewerId
            const canClaim =
              viewerId &&
              !split.viewerIsHost &&
              slot.status === "open" &&
              ["open", "filling"].includes(split.status)
            const canMarkPaid =
              split.viewerIsHost && slot.status === "claimed"
            const canConfirm =
              isMine &&
              split.status === "shipped" &&
              ["claimed", "paid"].includes(slot.status)

            return (
              <li
                key={slot.id}
                className="rounded-md border border-noir-gold/30 bg-noir-black/50 p-4 space-y-2"
              >
                <p className="font-medium text-noir-gold">{slot.ml} ml</p>
                <p className="text-xs uppercase tracking-wide text-noir-gold-300">
                  {t(`slotStatus.${slot.status}`)}
                </p>
                {slot.claimantUsername && (
                  <p className="text-sm text-noir-gold-100">
                    {t("claimant", { name: slot.claimantUsername })}
                  </p>
                )}
                {canClaim && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void postAction(`/api/decant-splits/${split.id}/claim`, {
                        slotId: slot.id,
                      })
                    }
                  >
                    {t("claimSlot")}
                  </Button>
                )}
                {canMarkPaid && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void postAction(
                        `/api/decant-splits/${split.id}/slots/${slot.id}/paid`
                      )
                    }
                  >
                    {t("markPaid")}
                  </Button>
                )}
                {canConfirm && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void postAction(
                        `/api/decant-splits/${split.id}/slots/${slot.id}/received`
                      )
                    }
                  >
                    {t("confirmReceived")}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {!viewerId && (
        <p className="text-sm text-noir-gold-100">{t("signInToClaim")}</p>
      )}
    </article>
  )
}

export default DecantSplitClient
