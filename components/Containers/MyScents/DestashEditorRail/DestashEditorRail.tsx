"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { FiExternalLink } from "react-icons/fi"

import { Button } from "@/components/Atoms/Button"
import DestashForm, {
  type DeStashFormActionState,
} from "@/components/Containers/MyScents/DeStashForm/DeStashForm"
import { SidePanelDrawer } from "@/components/Organisms/SidePanelDrawer"
import { useDestashEditSession } from "@/hooks/useDestashEditSession"
import { shouldConfirmDiscard } from "@/lib/destash-editor-interactions"
import { buildCleanCreateUserPerfume } from "@/lib/destash-form-payload"
import { parseMl } from "@/lib/user-inventory"
import type { UserPerfumeI } from "@/types"
import type { UserPerfumeForClient } from "@/types/my-scents-client"
import { CARD_IMAGE_COLOR_HOVER_CLASS } from "@/utils/card-motion"
import { getPrimaryListingImage } from "@/utils/listing-display"
import { normalizeRemoteImageSrc, validImageRegex } from "@/utils/styleUtils"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"
const FORM_ID_PREFIX = "destash-editor-form"

type DestashEditorRailProps = {
  /** Existing listing to edit (Exchange Listings / card edit). */
  listing?: UserPerfumeForClient | null
  /** Collection bottle to create a destash from (mutually exclusive with edit listing). */
  createFromBottle?: UserPerfumeForClient | null
  /** All inventory rows — used to decide first listing vs create-decant. */
  userPerfumes?: UserPerfumeForClient[]
  /** False when the listing left active/paused scope while the rail is open. */
  listingStillPresent?: boolean
  basePath: string
  onClose: () => void
  onListingChange: (updated: UserPerfumeForClient) => void
}

const DestashEditorRail = ({
  listing = null,
  createFromBottle = null,
  userPerfumes = [],
  listingStillPresent = true,
  basePath,
  onClose,
  onListingChange,
}: DestashEditorRailProps) => {
  const t = useTranslations("myScents.destashManager")
  const tListings = useTranslations("myScents.listings")
  const router = useRouter()
  const reactId = useId()
  const formId = `${FORM_ID_PREFIX}-${reactId.replace(/:/g, "")}`

  const isCreate = Boolean(createFromBottle)
  const mode = isCreate ? "create" : "edit"

  const createDraft = useMemo((): UserPerfumeI | null => {
    if (!createFromBottle) return null
    return buildCleanCreateUserPerfume({
      perfumeId: createFromBottle.perfumeId,
      perfumeName: createFromBottle.perfume?.name || "Unknown Perfume",
      perfume: createFromBottle.perfume as UserPerfumeI["perfume"],
      ownedAmountHint: createFromBottle.amount ?? "0",
      draftKey: createFromBottle.id,
    })
  }, [createFromBottle])

  const sessionListing = isCreate ? createDraft : listing

  const isFirstListingForPerfume = useMemo(() => {
    if (!createFromBottle) return false
    return !userPerfumes.some(
      up =>
        up.perfumeId === createFromBottle.perfumeId && parseMl(up.available) > 0
    )
  }, [createFromBottle, userPerfumes])

  const [actionState, setActionState] = useState<DeStashFormActionState>({
    submitDisabled: true,
    showPause: false,
    isDirty: false,
  })
  const [discardOpen, setDiscardOpen] = useState(false)
  /** When set, confirming discard navigates here instead of only closing. */
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (discardOpen) {
      keepEditingRef.current?.focus()
    }
  }, [discardOpen])

  const handleActionStateChange = useCallback((state: DeStashFormActionState) => {
    setActionState(state)
  }, [])

  const closeEditor = useCallback(() => {
    setDiscardOpen(false)
    setPendingHref(null)
    onClose()
  }, [onClose])

  const {
    snapshot,
    formSubmitting,
    isPausing,
    formError,
    blocker,
    handleDecantConfirm,
    handlePause,
  } = useDestashEditSession({
    listing: sessionListing,
    mode,
    sourceBottleId: createFromBottle?.id ?? null,
    isFirstListingForPerfume,
    listingStillPresent: isCreate ? true : listingStillPresent,
    onListingUpdated: onListingChange,
    onClosedAfterSuccess: closeEditor,
  })

  const open = Boolean(sessionListing && snapshot)
  const fullPageHref = createFromBottle
    ? `${basePath}/${createFromBottle.id}?list=1`
    : listing
      ? `${basePath}/${listing.id}#destash`
      : basePath
  const perfume = snapshot?.perfume
  const thumb = normalizeRemoteImageSrc(
    getPrimaryListingImage({
      images: snapshot?.images ?? [],
      perfume: { image: perfume?.image ?? null },
    })
  )
  const imageSrc =
    thumb && !validImageRegex.test(thumb) ? thumb : BOTTLE_PLACEHOLDER

  const busy = formSubmitting || isPausing
  const blocked = blocker != null
  const dirty = actionState.isDirty && !blocked

  const requestClose = useCallback(() => {
    if (discardOpen) {
      setDiscardOpen(false)
      setPendingHref(null)
      return
    }
    if (shouldConfirmDiscard(dirty)) {
      setPendingHref(null)
      setDiscardOpen(true)
      return
    }
    closeEditor()
  }, [closeEditor, dirty, discardOpen])

  const confirmDiscard = useCallback(() => {
    const href = pendingHref
    setDiscardOpen(false)
    setPendingHref(null)
    if (href) {
      onClose()
      router.push(href)
      return
    }
    closeEditor()
  }, [closeEditor, onClose, pendingHref, router])

  const requestOpenFullPage = useCallback(() => {
    if (shouldConfirmDiscard(dirty)) {
      setPendingHref(fullPageHref)
      setDiscardOpen(true)
      return
    }
    onClose()
    router.push(fullPageHref)
  }, [dirty, fullPageHref, onClose, router])

  const submitLabel = isCreate
    ? formSubmitting
      ? t("creating")
      : t("createDestash")
    : formSubmitting
      ? t("saving")
      : t("saveChanges")

  return (
    <SidePanelDrawer
      open={open}
      onClose={requestClose}
      title={isCreate ? t("createDestash") : t("editDestash")}
      closeLabel={t("closeEditor")}
      mobileHeight="full"
      width="editor"
      chrome="default"
      headerAside={
        <div className="flex justify-end">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="inline-flex w-auto items-center gap-1 px-0 text-sm"
            onClick={requestOpenFullPage}
            disabled={busy}
          >
            {t("openFullPage")}
            <FiExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      }
      footer={
        blocked ? (
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full md:w-full"
            onClick={closeEditor}
          >
            {t("closeEditor")}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full md:w-full"
                disabled={busy}
                onClick={requestClose}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                form={formId}
                variant="primary"
                size="lg"
                className="w-full md:w-full"
                disabled={actionState.submitDisabled || busy}
              >
                {submitLabel}
              </Button>
            </div>
            {!isCreate && actionState.showPause && (
              <Button
                type="button"
                variant="danger"
                size="lg"
                className="w-full md:w-full"
                disabled={busy}
                onClick={() => void handlePause()}
              >
                {isPausing ? t("pausing") : t("pauseListing")}
              </Button>
            )}
          </div>
        )
      }
    >
      {snapshot && sessionListing && (
        <div className="relative space-y-4">
          {discardOpen && (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="destash-discard-title"
              aria-describedby="destash-discard-desc"
              className="absolute inset-0 z-40 flex items-center justify-center bg-noir-black/80 p-4"
            >
              <div className="w-full max-w-sm space-y-4 rounded border border-noir-gold bg-noir-dark p-4 shadow-xl">
                <h3
                  id="destash-discard-title"
                  className="!mb-0 text-xl text-noir-gold"
                >
                  {t("discardHeading")}
                </h3>
                <p id="destash-discard-desc" className="text-sm text-noir-gold-100">
                  {pendingHref
                    ? t("discardOpenFullPageDescription")
                    : t("discardDescription")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    ref={keepEditingRef}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full md:w-full"
                    onClick={() => {
                      setDiscardOpen(false)
                      setPendingHref(null)
                    }}
                  >
                    {t("keepEditing")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="w-full md:w-full"
                    onClick={confirmDiscard}
                  >
                    {t("discardChanges")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 rounded border border-noir-gold/30 bg-noir-black/40 p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-noir-black">
              <Image
                src={imageSrc}
                alt={perfume?.name ?? "Perfume"}
                fill
                className={CARD_IMAGE_COLOR_HOVER_CLASS}
                sizes="64px"
              />
            </div>
            <div className="min-w-0 flex-1">
              {perfume?.perfumeHouse?.name ? (
                <p className="break-words text-sm text-noir-gold-100">
                  {perfume.perfumeHouse.name}
                </p>
              ) : null}
              <p className="break-words font-semibold text-noir-gold">
                {perfume?.name}
              </p>
              <p className="mt-1 text-xs text-noir-cream">
                {isCreate
                  ? t("sourceBottleRemaining", {
                      amount: parseMl(snapshot.amount).toFixed(1),
                    })
                  : tListings("listedMl", {
                      ml: (
                        parseMl(snapshot.available) > 0
                          ? parseMl(snapshot.available)
                          : parseMl(snapshot.pausedAvailable)
                      ).toFixed(1),
                    })}
              </p>
            </div>
          </div>

          {blocker === "gone" && (
            <p className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100" role="alert">
              {t("editListingGone")}
            </p>
          )}
          {blocker === "forbidden" && (
            <p className="rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300" role="alert">
              {t("editForbidden")}
            </p>
          )}

          {formError && !blocked && (
            <p
              className="rounded border border-red-500/40 bg-red-950/30 p-2 text-sm text-red-400"
              role="alert"
            >
              {formError}
            </p>
          )}

          {!blocked && (
            <DestashForm
              key={
                isCreate
                  ? `rail-create-${createFromBottle?.id ?? snapshot.id}`
                  : `rail-edit-${snapshot.id}`
              }
              formId={formId}
              layout="rail"
              perfumeId={sessionListing.perfumeId}
              userPerfume={snapshot}
              handleDecantConfirm={handleDecantConfirm}
              isEditing={!isCreate}
              isCreating={isCreate}
              isSubmitting={formSubmitting}
              onPause={isCreate ? undefined : () => void handlePause()}
              isPausing={isPausing}
              onActionStateChange={handleActionStateChange}
            />
          )}
        </div>
      )}
    </SidePanelDrawer>
  )
}

export default DestashEditorRail
