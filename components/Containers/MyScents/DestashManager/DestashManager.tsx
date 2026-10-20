import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { MdAdd } from "react-icons/md"
import { LuSplit } from "react-icons/lu"

import { Button } from "@/components/Atoms/Button"
import { useCSRF } from "@/hooks/useCSRF"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"
import {
  appendDestashListingFields,
  buildCleanCreateUserPerfume,
  mergeListingIntoCollection,
  parseDestashApiResponse,
  toDestashListingSubmitPayload,
  type DestashApiResult,
} from "@/lib/destash-form-payload"
import {
  getActiveListings,
  getPausedListings,
  getResumeListingMl,
  isCollectionBottle,
  parseMl,
} from "@/lib/user-inventory"
import { resolveListingApiError } from "@/lib/resolve-listing-api-error"
import { isDecantSplitsEnabledClient } from "@/utils/decant-splits-enabled"

import DecantSplitWizard from "../DecantSplit/DecantSplitWizard"
import DestashForm, { type DeStashData } from "../DeStashForm/DeStashForm"
import DestashItem from "./DestashItem"
import PausedDestashItem from "./PausedDestashItem"

type ListingAction = "pausing" | "resuming" | "removing" | "saving"

interface DestashManagerProps {
  perfumeId: string
  userPerfumes: UserPerfumeI[]
  setUserPerfumes: Dispatch<SetStateAction<UserPerfumeI[]>>
  apiBasePath?: string
  currentBottleId?: string
  autoStartCreate?: boolean
}

const DestashManager = ({
  perfumeId,
  userPerfumes,
  setUserPerfumes,
  apiBasePath = "/api/user-perfumes",
  currentBottleId,
  autoStartCreate = false,
}: DestashManagerProps) => {
  const t = useTranslations("myScents.destashManager")
  const tSplits = useTranslations("decantSplits.wizard")
  const tListingErrors = useTranslations("listing.errors")
  const router = useRouter()
  const { addToFormData } = useCSRF()
  const { closeModal } = useSessionStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  /** Snapshot so parent refreshes cannot overwrite an in-progress edit. */
  const [editingSnapshot, setEditingSnapshot] = useState<UserPerfumeI | null>(
    null
  )
  const [isCreating, setIsCreating] = useState(autoStartCreate)
  const [showSplitWizard, setShowSplitWizard] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pauseAllBusy, setPauseAllBusy] = useState(false)
  const [pauseAllError, setPauseAllError] = useState<string | null>(null)
  const [pendingById, setPendingById] = useState<Record<string, ListingAction>>(
    {}
  )
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  const formSubmitLockRef = useRef(false)
  const listingActionLocksRef = useRef<Set<string>>(new Set())

  const setListingPending = (id: string, action: ListingAction | null) => {
    setPendingById(prev => {
      if (action == null) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: action }
    })
  }

  const setListingError = (id: string, message: string | null) => {
    setErrorById(prev => {
      if (message == null) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: message }
    })
  }

  const resolveErrorMessage = useCallback(
    (result: DestashApiResult, fallback: string) => {
      if (result.networkError) {
        return t("networkError")
      }
      if (result.malformed || (!result.ok && !result.error && !result.errorCode)) {
        return t("unexpectedResponse")
      }
      return (
        resolveListingApiError(
          { error: result.error, errorCode: result.errorCode },
          tListingErrors
        ) ??
        result.error ??
        fallback
      )
    },
    [t, tListingErrors]
  )

  const postDestash = useCallback(
    async (formData: FormData): Promise<DestashApiResult> => {
      addToFormData(formData)
      try {
        const res = await fetch(apiBasePath, {
          method: "POST",
          body: formData,
          credentials: "include",
        })
        return parseDestashApiResponse(res)
      } catch {
        return {
          ok: false,
          status: 0,
          success: false,
          malformed: false,
          networkError: true,
        }
      }
    },
    [apiBasePath, addToFormData]
  )

  const applySuccessfulListing = useCallback(
    (updated: UserPerfumeI) => {
      // While editing another row, still merge list data; edit form uses snapshot.
      setUserPerfumes(prev => mergeListingIntoCollection(prev, updated))
    },
    [setUserPerfumes]
  )

  const entriesForPerfume = userPerfumes.filter(up => up.perfumeId === perfumeId)
  const destashes = getActiveListings(entriesForPerfume)
  const pausedDestashes = getPausedListings(entriesForPerfume)

  const handleCreateNew = () => {
    setIsCreating(true)
    setEditingId(null)
    setEditingSnapshot(null)
    setFormError(null)
    setPauseAllError(null)
  }

  const handleEdit = (id: string) => {
    const row = userPerfumes.find(up => up.id === id)
    if (!row) return
    setEditingId(id)
    setEditingSnapshot({ ...row })
    setIsCreating(false)
    setFormError(null)
    setPauseAllError(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditingSnapshot(null)
    setIsCreating(false)
    setFormError(null)
  }

  const pauseListing = async (
    userPerfumeId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (listingActionLocksRef.current.has(userPerfumeId)) {
      return { ok: false }
    }
    const current = userPerfumes.find(up => up.id === userPerfumeId)
    if (!current || parseMl(current.available) <= 0) return { ok: false }

    listingActionLocksRef.current.add(userPerfumeId)
    setListingPending(userPerfumeId, "pausing")
    setListingError(userPerfumeId, null)

    const previous = { ...current }
    const pausedSnapshot = current.available
    setUserPerfumes(prev =>
      prev.map(perfume =>
        perfume.id === userPerfumeId
          ? {
              ...perfume,
              available: "0",
              pausedAvailable: pausedSnapshot,
            }
          : perfume
      )
    )

    const formData = new FormData()
    formData.append("action", "decant")
    formData.append("userPerfumeId", userPerfumeId)
    formData.append("perfumeId", perfumeId)
    formData.append("amount", "0")

    try {
      const result = await postDestash(formData)
      if (result.success) {
        if (result.userPerfume) {
          applySuccessfulListing({
            ...result.userPerfume,
            available: "0",
            pausedAvailable:
              result.userPerfume.pausedAvailable ?? pausedSnapshot,
          })
        }
        return { ok: true }
      }

      setUserPerfumes(prev =>
        prev.map(perfume => (perfume.id === userPerfumeId ? previous : perfume))
      )
      const message = resolveErrorMessage(result, t("pauseFailed"))
      setListingError(userPerfumeId, message)
      return { ok: false, error: message }
    } finally {
      listingActionLocksRef.current.delete(userPerfumeId)
      setListingPending(userPerfumeId, null)
    }
  }

  const resumeListing = async (
    userPerfumeId: string,
    pausedAvailable: string
  ) => {
    if (listingActionLocksRef.current.has(userPerfumeId)) return
    const current = userPerfumes.find(up => up.id === userPerfumeId)
    if (!current) return

    listingActionLocksRef.current.add(userPerfumeId)
    setListingPending(userPerfumeId, "resuming")
    setListingError(userPerfumeId, null)

    const previous = { ...current }
    const amount = pausedAvailable
    setUserPerfumes(prev =>
      prev.map(perfume =>
        perfume.id === userPerfumeId
          ? { ...perfume, available: amount, pausedAvailable: null }
          : perfume
      )
    )

    const formData = new FormData()
    formData.append("action", "decant")
    formData.append("userPerfumeId", userPerfumeId)
    formData.append("perfumeId", perfumeId)
    formData.append("amount", amount)
    formData.append("resumePaused", "true")

    try {
      const result = await postDestash(formData)
      if (result.success) {
        if (result.userPerfume) {
          applySuccessfulListing({
            ...result.userPerfume,
            available: amount,
            pausedAvailable: null,
          })
        }
        return
      }
      setUserPerfumes(prev =>
        prev.map(perfume => (perfume.id === userPerfumeId ? previous : perfume))
      )
      setListingError(
        userPerfumeId,
        resolveErrorMessage(result, t("resumeFailed"))
      )
    } finally {
      listingActionLocksRef.current.delete(userPerfumeId)
      setListingPending(userPerfumeId, null)
    }
  }

  const removePausedListing = async (userPerfumeId: string) => {
    if (listingActionLocksRef.current.has(userPerfumeId)) return
    const current = userPerfumes.find(up => up.id === userPerfumeId)
    if (!current) return

    listingActionLocksRef.current.add(userPerfumeId)
    setListingPending(userPerfumeId, "removing")
    setListingError(userPerfumeId, null)

    const previous = { ...current }
    setUserPerfumes(prev =>
      prev.map(perfume =>
        perfume.id === userPerfumeId
          ? { ...perfume, pausedAvailable: null }
          : perfume
      )
    )

    const formData = new FormData()
    formData.append("action", "decant")
    formData.append("userPerfumeId", userPerfumeId)
    formData.append("perfumeId", perfumeId)
    formData.append("amount", "0")

    try {
      const result = await postDestash(formData)
      if (result.success) {
        if (result.userPerfume) {
          applySuccessfulListing({
            ...result.userPerfume,
            pausedAvailable: null,
          })
        }
        return
      }
      setUserPerfumes(prev =>
        prev.map(perfume => (perfume.id === userPerfumeId ? previous : perfume))
      )
      setListingError(
        userPerfumeId,
        resolveErrorMessage(result, t("removePausedFailed"))
      )
    } finally {
      listingActionLocksRef.current.delete(userPerfumeId)
      setListingPending(userPerfumeId, null)
    }
  }

  const handleDelete = (userPerfumeId: string) => {
    closeModal()
    if (userPerfumes.find(up => up.id === userPerfumeId)) {
      void pauseListing(userPerfumeId)
    }
  }

  const handlePauseAll = async () => {
    if (destashes.length === 0 || pauseAllBusy || formSubmitting) return
    setPauseAllBusy(true)
    setPauseAllError(null)

    const targets = [...destashes]
    let failed = 0
    for (const destash of targets) {
      const result = await pauseListing(destash.id)
      if (!result.ok) failed += 1
    }

    if (failed > 0) {
      setPauseAllError(
        t("pauseAllPartialFailure", {
          failed,
          total: targets.length,
        })
      )
    }
    setPauseAllBusy(false)
  }

  const handleDecantConfirm = async (data: DeStashData) => {
    if (formSubmitLockRef.current) return
    formSubmitLockRef.current = true
    setFormSubmitting(true)
    setFormError(null)

    const payload = toDestashListingSubmitPayload(data)
    const formData = new FormData()
    formData.append("perfumeId", perfumeId)
    formData.append("amount", payload.amount)
    appendDestashListingFields(formData, payload)

    const isEditing = Boolean(editingId && !isCreating && !data.createNew)

    if (isEditing && editingId) {
      formData.append("action", "decant")
      formData.append("userPerfumeId", editingId)
      setListingPending(editingId, "saving")
    } else if (isCreating && currentBottleId) {
      const activeDestashes = userPerfumes.filter(
        up => up.perfumeId === perfumeId && parseMl(up.available) > 0
      )
      const isFirstListingForPerfume = activeDestashes.length === 0
      if (isFirstListingForPerfume) {
        formData.append("action", "decant")
        formData.append("userPerfumeId", currentBottleId)
      } else {
        formData.append("action", "create-decant")
      }
    } else {
      formData.append("action", "create-decant")
    }

    try {
      const result = await postDestash(formData)
      if (result.success && result.userPerfume) {
        applySuccessfulListing(result.userPerfume)
        setIsCreating(false)
        setEditingId(null)
        setEditingSnapshot(null)
        setFormError(null)
        return
      }

      // Keep form open with entered values/photos (form state is local).
      setFormError(resolveErrorMessage(result, t("saveFailed")))
    } finally {
      if (editingId) setListingPending(editingId, null)
      formSubmitLockRef.current = false
      setFormSubmitting(false)
    }
  }

  const anyListingBusy = Object.keys(pendingById).length > 0
  const toolbarDisabled = formSubmitting || pauseAllBusy || anyListingBusy

  const sourceBottle = currentBottleId
    ? userPerfumes.find(up => up.id === currentBottleId)
    : userPerfumes.find(
        up => up.perfumeId === perfumeId && isCollectionBottle(up)
      )

  const createUserPerfume = buildCleanCreateUserPerfume({
    perfumeId,
    perfumeName:
      sourceBottle?.perfume?.name ||
      userPerfumes.find(up => up.perfume?.id === perfumeId)?.perfume?.name ||
      "Unknown Perfume",
    perfume: sourceBottle?.perfume,
    ownedAmountHint: sourceBottle?.amount ?? "0",
  })

  const handleFormPause = async () => {
    if (!editingId) return
    const result = await pauseListing(editingId)
    if (result.ok) {
      setEditingId(null)
      setEditingSnapshot(null)
      setFormError(null)
      return
    }
    if (result.error) setFormError(result.error)
  }

  return (
    <div className="p-4 rounded-b-md bg-noir-dark/80">
      <div className="flex flex-col md:flex-row gap-3 md:gap-0 justify-between items-center">
        <h3>{t("title")}</h3>
        {!isCreating && !editingId && (
          <div className="flex flex-wrap gap-2">
            {destashes.length > 1 && (
              <Button
                onClick={() => void handlePauseAll()}
                variant="secondary"
                size="sm"
                disabled={toolbarDisabled}
              >
                {pauseAllBusy ? t("pausingAll") : t("pauseAll")}
              </Button>
            )}
            <Button
              onClick={handleCreateNew}
              variant="primary"
              size="sm"
              leftIcon={<MdAdd size={18} />}
              disabled={toolbarDisabled}
            >
              {t("addNew")}
            </Button>
            {isDecantSplitsEnabledClient() && (
              <Button
                onClick={() => setShowSplitWizard(true)}
                variant="secondary"
                size="sm"
                leftIcon={<LuSplit size={18} />}
                disabled={toolbarDisabled || showSplitWizard}
              >
                {tSplits("startGroupSplit")}
              </Button>
            )}
          </div>
        )}
      </div>

      {showSplitWizard && (
        <DecantSplitWizard
          perfumeId={perfumeId}
          sourceUserPerfumeId={currentBottleId}
          onCreated={splitId => {
            setShowSplitWizard(false)
            router.push(`/splits/${splitId}`)
          }}
          onCancel={() => setShowSplitWizard(false)}
        />
      )}

      <p className="text-noir-gold-100 font-medium wrap-anywhere mb-4">
        {t("description")}
      </p>

      {pauseAllError && (
        <p className="mb-3 text-sm text-red-400 bg-red-950/30 border border-red-500/40 rounded p-2">
          {pauseAllError}
        </p>
      )}

      {!isCreating && !editingId && (
        <div className="space-y-3">
          {destashes.length === 0 && pausedDestashes.length === 0 ? (
            <p className="text-noir-gold-500 italic leading-none text-center py-4 text-sm">
              {t("noDestashes")}
            </p>
          ) : (
            <>
              {destashes.map(destash => (
                <div key={destash.id} className="space-y-1">
                  <DestashItem
                    destash={destash}
                    onEdit={() => handleEdit(destash.id)}
                    onDelete={() => handleDelete(destash.id)}
                    isBusy={pendingById[destash.id] === "pausing"}
                  />
                  {errorById[destash.id] && (
                    <p className="text-sm text-red-400 px-1">
                      {errorById[destash.id]}
                    </p>
                  )}
                </div>
              ))}
              {pausedDestashes.length > 0 && (
                <div className="space-y-2 border-t border-noir-gold/20 pt-4">
                  <h4 className="text-sm font-semibold text-noir-dark">
                    {t("pausedHeading")}
                  </h4>
                  {pausedDestashes.map(destash => (
                    <div key={destash.id} className="space-y-1">
                      <PausedDestashItem
                        destash={destash}
                        isResuming={pendingById[destash.id] === "resuming"}
                        isRemoving={pendingById[destash.id] === "removing"}
                        onResume={() =>
                          void resumeListing(
                            destash.id,
                            destash.pausedAvailable ??
                              String(getResumeListingMl(destash))
                          )
                        }
                        onRemove={() => void removePausedListing(destash.id)}
                      />
                      {errorById[destash.id] && (
                        <p className="text-sm text-red-400 px-1">
                          {errorById[destash.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {formError && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-500/40 rounded p-2">
          {formError}
        </p>
      )}

      {(isCreating || editingId) && (
        <div className="noir-border p-4 bg-noir-black/50 rounded-md">
          <div className="flex justify-between items-center">
            <h3>{isCreating ? t("createNew") : t("editDestash")}</h3>
            <Button
              onClick={handleCancel}
              variant="secondary"
              size="sm"
              disabled={formSubmitting}
            >
              {t("cancel")}
            </Button>
          </div>

          {editingSnapshot && editingId && (
            <DestashForm
              key={`edit-${editingSnapshot.id}`}
              perfumeId={perfumeId}
              userPerfume={editingSnapshot}
              handleDecantConfirm={handleDecantConfirm}
              isEditing={true}
              isSubmitting={formSubmitting}
              onPause={() => void handleFormPause()}
              isPausing={pendingById[editingId] === "pausing"}
            />
          )}
          {isCreating && (
            <DestashForm
              key={`create-new-${currentBottleId ?? "standalone"}`}
              perfumeId={perfumeId}
              userPerfume={createUserPerfume}
              handleDecantConfirm={handleDecantConfirm}
              isCreating={true}
              isSubmitting={formSubmitting}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default DestashManager
