import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { MdAdd } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import { useCSRF } from "@/hooks/useCSRF"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"

import {
  getActiveListings,
  getPausedListings,
  getResumeListingMl,
  isCollectionBottle,
  parseMl,
} from "@/lib/user-inventory"
import { resolveListingApiError } from "@/lib/resolve-listing-api-error"

import DecantSplitWizard from "../DecantSplit/DecantSplitWizard"
import DestashForm, { type DeStashData } from "../DeStashForm/DeStashForm"
import DestashItem from "./DestashItem"
import PausedDestashItem from "./PausedDestashItem"
import { isDecantSplitsEnabledClient } from "@/utils/decant-splits-enabled"
import { LuSplit } from "react-icons/lu"

const totalDestashedForPerfume = (entriesForPerfume: UserPerfumeI[]) =>
  entriesForPerfume.reduce((sum, e) => sum + parseMl(e.available), 0)

const standaloneDestashMl = (entriesForPerfume: UserPerfumeI[]) =>
  entriesForPerfume
    .filter((e) => !isCollectionBottle(e) && parseMl(e.available) > 0)
    .reduce((sum, e) => sum + parseMl(e.available), 0)

/** How much has already been listed from this bottle (row + separate destash entries). */
const getDestashedMlForBottle = (
  sourceBottleId: string,
  entriesForPerfume: UserPerfumeI[]
) => {
  const source = entriesForPerfume.find((e) => e.id === sourceBottleId)
  if (!source || !isCollectionBottle(source)) return 0

  const collectionBottles = entriesForPerfume.filter(isCollectionBottle)

  if (collectionBottles.length <= 1) {
    return totalDestashedForPerfume(entriesForPerfume)
  }

  return parseMl(source.available) + standaloneDestashMl(entriesForPerfume)
}

interface DestashManagerProps {
  perfumeId: string
  userPerfumes: UserPerfumeI[]
  setUserPerfumes: Dispatch<SetStateAction<UserPerfumeI[]>>
  apiBasePath?: string
  /** When on a single-bottle page, pass this bottle's id so new decants use it as source (no dropdown). */
  currentBottleId?: string
  /** Open the create-listing form on mount (e.g. ?list=1 destash CTA). */
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
  const router = useRouter()
  const tListingErrors = useTranslations("listing.errors")
  const { addToFormData } = useCSRF()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(autoStartCreate)
  const [resumeTargetId, setResumeTargetId] = useState<string | null>(null)
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null)
  const [showSplitWizard, setShowSplitWizard] = useState(false)
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle")
  const [submitData, setSubmitData] = useState<{
    success?: boolean
    userPerfume?: UserPerfumeI
    error?: string
  } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const previousStateRef = useRef<"idle" | "submitting">("idle")
  const submittedRef = useRef(false)
  const { closeModal } = useSessionStore()

  const submitForm = useCallback(
    async (formData: FormData) => {
      setSubmitState("submitting")
      setSubmitError(null)
      submittedRef.current = true
      addToFormData(formData)
      try {
        const res = await fetch(apiBasePath, {
          method: "POST",
          body: formData,
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        setSubmitData(data)
        return data
      } finally {
        setSubmitState("idle")
      }
    },
    [apiBasePath, addToFormData]
  )

  useEffect(() => {
    const responseData = submitData
    const isSuccess =
      responseData &&
      typeof responseData === "object" &&
      "success" in responseData
        ? (responseData as { success?: boolean }).success
        : false

    const transitionedToIdle =
      previousStateRef.current === "submitting" && submitState === "idle"

    if (transitionedToIdle && submittedRef.current && !isSuccess) {
      const payload =
        responseData && typeof responseData === "object"
          ? (responseData as { error?: string; errorCode?: string })
          : {}
      setSubmitError(resolveListingApiError(payload, tListingErrors))
    }

    if (transitionedToIdle && isSuccess && submittedRef.current) {
      setSubmitError(null)
      if (
        responseData &&
        typeof responseData === "object" &&
        "userPerfume" in responseData
      ) {
        const updatedUserPerfume = (responseData as { userPerfume: UserPerfumeI })
          .userPerfume
        if (updatedUserPerfume) {
          setUserPerfumes((prev) => {
            const index = prev.findIndex((up) => up.id === updatedUserPerfume.id)
            if (index >= 0) {
              const updated = [...prev]
              updated[index] = updatedUserPerfume
              return updated
            }
            return [...prev, updatedUserPerfume]
          })
        }
      }
      setIsCreating(false)
      setEditingId(null)
      submittedRef.current = false
    }

    previousStateRef.current = submitState
  }, [submitState, submitData, setUserPerfumes, tListingErrors])

  const entriesForPerfume = userPerfumes.filter((up) => up.perfumeId === perfumeId)
  const destashes = getActiveListings(entriesForPerfume)
  const pausedDestashes = getPausedListings(entriesForPerfume)

  const totalOwned = entriesForPerfume.reduce((sum, entry) => {
    const amt = parseFloat(entry.amount?.replace(/[^0-9.]/g, "") || "0")
    return sum + (isNaN(amt) ? 0 : amt)
  }, 0)
  const totalDestashed = totalDestashedForPerfume(entriesForPerfume)
  const poolRemaining = Math.max(0, totalOwned - totalDestashed)

  const handleCreateNew = () => {
    setIsCreating(true)
    setEditingId(null)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setIsCreating(false)
  }

  const handleCancel = () => {
    setEditingId(null)
    setIsCreating(false)
  }

  const pauseListing = (userPerfumeId: string) => {
    setUserPerfumes((prev) =>
      prev.map((perfume) => {
        if (perfume.id !== userPerfumeId) return perfume
        const listed = parseMl(perfume.available)
        if (listed <= 0) return perfume
        return {
          ...perfume,
          available: "0",
          pausedAvailable: perfume.available,
        }
      })
    )
    const formData = new FormData()
    formData.append("action", "decant")
    formData.append("userPerfumeId", userPerfumeId)
    formData.append("perfumeId", perfumeId)
    formData.append("amount", "0")
    submitForm(formData)
  }

  const resumeListing = async (userPerfumeId: string, pausedAvailable: string) => {
    setResumeTargetId(userPerfumeId)
    try {
      const formData = new FormData()
      formData.append("action", "decant")
      formData.append("userPerfumeId", userPerfumeId)
      formData.append("perfumeId", perfumeId)
      formData.append("amount", pausedAvailable)
      formData.append("resumePaused", "true")
      await submitForm(formData)
    } finally {
      setResumeTargetId(null)
    }
  }

  const removePausedListing = (userPerfumeId: string) => {
    setRemoveTargetId(userPerfumeId)
    setUserPerfumes((prev) =>
      prev.map((perfume) =>
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
    submitForm(formData).finally(() => setRemoveTargetId(null))
  }

  const handleDelete = (userPerfumeId: string) => {
    closeModal()
    if (userPerfumes.find((up) => up.id === userPerfumeId)) {
      pauseListing(userPerfumeId)
    }
  }

  const handlePauseAll = () => {
    if (destashes.length === 0) return
    for (const destash of destashes) {
      pauseListing(destash.id)
    }
  }

  const appendListingFields = (formData: FormData, data: DeStashData) => {
    formData.append("images", JSON.stringify(data.images))
    if (data.condition) formData.append("condition", data.condition)
    if (data.decantFormat) formData.append("decantFormat", data.decantFormat)
  }

  const handleDecantConfirm = (data: DeStashData) => {
    const formData = new FormData()
    formData.append("perfumeId", perfumeId)
    formData.append("tradePreference", data.tradePreference)
    formData.append("tradeOnly", data.tradeOnly.toString())

    const isEditing = editingId && !isCreating && !data.createNew

    if (isEditing) {
      formData.append("action", "decant")
      formData.append("userPerfumeId", editingId)
      formData.append("amount", data.amount)
      if (data.price) formData.append("tradePrice", data.price)
      appendListingFields(formData, data)
    } else if (isCreating && currentBottleId) {
      const activeDestashes = userPerfumes.filter(
        (up) => up.perfumeId === perfumeId && parseMl(up.available) > 0
      )
      const isFirstListingForPerfume = activeDestashes.length === 0

      if (isFirstListingForPerfume) {
        formData.append("action", "decant")
        formData.append("userPerfumeId", currentBottleId)
      } else {
        formData.append("action", "create-decant")
      }
      formData.append("amount", data.amount)
      if (data.price) formData.append("tradePrice", data.price)
      appendListingFields(formData, data)
    } else {
      // No current bottle context: standalone destash entry
      formData.append("action", "create-decant")
      formData.append("amount", data.amount)
      if (data.price) formData.append("tradePrice", data.price)
      appendListingFields(formData, data)
    }

    submitForm(formData)
  }

  const editingDestash = editingId
    ? userPerfumes.find(up => up.id === editingId)
    : null

  return (
    <div className="p-4 rounded-b-md bg-noir-dark/80">
      <div className="flex flex-col md:flex-row gap-3 md:gap-0 justify-between items-center">
        <h3>
          {t("title")}
        </h3>
        {!isCreating && !editingId && (
          <div className="flex flex-wrap gap-2">
            {destashes.length > 1 && (
              <Button
                onClick={handlePauseAll}
                variant="secondary"
                size="sm"
                disabled={submitState === "submitting"}
              >
                {t("pauseAll")}
              </Button>
            )}
            <Button
              onClick={handleCreateNew}
              variant="primary"
              size="sm"
              leftIcon={<MdAdd size={18} />}
              disabled={submitState === "submitting"}
            >
              {t("addNew")}
            </Button>
            {isDecantSplitsEnabledClient() && (
              <Button
                onClick={() => setShowSplitWizard(true)}
                variant="secondary"
                size="sm"
                leftIcon={<LuSplit size={18} />}
                disabled={submitState === "submitting" || showSplitWizard}
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

      {/* List of existing destashes */}
      {!isCreating && !editingId && (
        <div className="space-y-3">
          {destashes.length === 0 && pausedDestashes.length === 0 ? (
            <p className="text-noir-gold-500 italic leading-none text-center py-4 text-sm">
              {t("noDestashes")}
            </p>
          ) : (
            <>
              {destashes.map((destash) => (
                <DestashItem
                  key={destash.id}
                  destash={destash}
                  onEdit={() => handleEdit(destash.id)}
                  onDelete={() => handleDelete(destash.id)}
                />
              ))}
              {pausedDestashes.length > 0 && (
                <div className="space-y-2 border-t border-noir-gold/20 pt-4">
                  <h4 className="text-sm font-semibold text-noir-dark">
                    {t("pausedHeading")}
                  </h4>
                  {pausedDestashes.map((destash) => (
                    <PausedDestashItem
                      key={destash.id}
                      destash={destash}
                      isResuming={resumeTargetId === destash.id}
                      isRemoving={removeTargetId === destash.id}
                      onResume={() =>
                        resumeListing(
                          destash.id,
                          destash.pausedAvailable ?? String(getResumeListingMl(destash))
                        )
                      }
                      onRemove={() => removePausedListing(destash.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create/Edit Form */}
      {submitError && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-500/40 rounded p-2">
          {submitError}
        </p>
      )}

      {(isCreating || editingId) && (
        <div className="noir-border p-4 bg-noir-black/50 rounded-md">
          <div className="flex justify-between items-center">
            <h3>
              {isCreating
                ? t("createNew")
                : t("editDestash")}
            </h3>
            <Button onClick={handleCancel} variant="secondary" size="sm">
              {t("cancel")}
            </Button>
          </div>

          {editingDestash && (
            <DestashForm
              key={`edit-${editingDestash.id}`}
              userPerfume={editingDestash}
              handleDecantConfirm={handleDecantConfirm}
              isEditing={true}
              maxAvailable={totalOwned > 0
                ? totalOwned - totalDestashed + parseFloat(editingDestash.available || "0")
                : undefined}
            />
          )}
          {isCreating && (() => {
            // Use current bottle when on single-bottle page; otherwise first entry for this perfume or fallback
            const sourceBottle = currentBottleId
              ? userPerfumes.find(up => up.id === currentBottleId)
              : userPerfumes.find(
                  up => up.perfumeId === perfumeId && isCollectionBottle(up)
                )
            const fallbackFirst = userPerfumes?.[0]
            let finalUserPerfume = sourceBottle || fallbackFirst

            if (!finalUserPerfume) {
              const anyUserPerfume = userPerfumes?.find(up => up.perfume?.id === perfumeId) || userPerfumes?.[0]
              const perfumeName = anyUserPerfume?.perfume?.name || "Unknown Perfume"
              finalUserPerfume = {
                id: `temp-${perfumeId}`,
                userId: "",
                perfumeId,
                perfume: { id: perfumeId, name: perfumeName },
                amount: "0",
                available: "0",
                price: undefined,
                tradePrice: undefined,
                tradePreference: "cash",
                tradeOnly: false,
              } as UserPerfumeI
            }

            let formMaxAvailable: number | undefined
            if (currentBottleId && sourceBottle) {
              const destashedFromBottle = getDestashedMlForBottle(
                sourceBottle.id,
                entriesForPerfume
              )
              const bottleRemaining = Math.max(
                0,
                parseMl(sourceBottle.amount) - destashedFromBottle
              )
              formMaxAvailable = Math.min(bottleRemaining, poolRemaining)
            } else {
              formMaxAvailable = poolRemaining > 0 ? poolRemaining : undefined
            }

            return (
              <>
                {currentBottleId && formMaxAvailable != null && (
                  <p className="text-sm text-noir-gold-100">
                    {t("bottleDestashHint", { max: formMaxAvailable })}
                  </p>
                )}
                <DestashForm
                  key={`create-new-${currentBottleId ?? "standalone"}`}
                  userPerfume={finalUserPerfume}
                  handleDecantConfirm={handleDecantConfirm}
                  isCreating={true}
                  maxAvailable={formMaxAvailable}
                />
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default DestashManager
