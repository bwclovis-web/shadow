"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import type { DeStashData } from "@/components/Containers/MyScents/DeStashForm/DeStashForm"
import {
  classifyDestashEditFailure,
  nextEditSnapshotTransition,
} from "@/lib/destash-editor-interactions"
import {
  appendDestashListingFields,
  parseDestashApiResponse,
  toDestashListingSubmitPayload,
  type DestashApiResult,
} from "@/lib/destash-form-payload"
import { resolveListingApiError } from "@/lib/resolve-listing-api-error"
import { parseMl } from "@/lib/user-inventory"
import { useCSRF } from "@/hooks/useCSRF"
import type { UserPerfumeI } from "@/types"
import type { UserPerfumeForClient } from "@/types/my-scents-client"

type ListingRow = UserPerfumeForClient | UserPerfumeI

const toUserPerfumeI = (row: ListingRow): UserPerfumeI =>
  row as unknown as UserPerfumeI

export type DestashEditBlocker = "gone" | "forbidden" | null

export type DestashSessionMode = "edit" | "create"

type UseDestashEditSessionParams = {
  listing: ListingRow | null
  /** edit = update existing listing; create = new destash from a collection bottle. */
  mode?: DestashSessionMode
  /** Collection bottle id for create submits (`decant` / `create-decant`). */
  sourceBottleId?: string | null
  /**
   * When creating: first active listing for the perfume uses `decant` on the bottle;
   * otherwise `create-decant` (same rules as DestashManager).
   */
  isFirstListingForPerfume?: boolean
  /** When false, listing left active/paused scope (removed or cleared). */
  listingStillPresent?: boolean
  apiBasePath?: string
  onListingUpdated: (updated: UserPerfumeForClient) => void
  onClosedAfterSuccess?: () => void
}

/**
 * Shared edit/pause/create session for DestashEditorRail.
 * Same FormData + API path as DestashManager — no parallel validation.
 * Keeps draft snapshot when the same listing id is re-passed from the parent.
 */
export const useDestashEditSession = ({
  listing,
  mode = "edit",
  sourceBottleId = null,
  isFirstListingForPerfume = false,
  listingStillPresent = true,
  apiBasePath = "/api/user-perfumes",
  onListingUpdated,
  onClosedAfterSuccess,
}: UseDestashEditSessionParams) => {
  const t = useTranslations("myScents.destashManager")
  const tListingErrors = useTranslations("listing.errors")
  const { addToFormData } = useCSRF()

  const [snapshot, setSnapshot] = useState<UserPerfumeI | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [blocker, setBlocker] = useState<DestashEditBlocker>(null)
  const submitLockRef = useRef(false)
  const pauseLockRef = useRef(false)
  const loadedListingIdRef = useRef<string | null>(null)

  useEffect(() => {
    const transition = nextEditSnapshotTransition(
      loadedListingIdRef.current,
      listing?.id ?? null
    )
    if (transition === "clear") {
      loadedListingIdRef.current = null
      setSnapshot(null)
      setFormError(null)
      setBlocker(null)
      return
    }
    if (transition === "load" && listing) {
      loadedListingIdRef.current = listing.id
      setSnapshot({ ...toUserPerfumeI(listing) })
      setFormError(null)
      setBlocker(null)
    }
  }, [listing])

  useEffect(() => {
    if (listing && !listingStillPresent) {
      setBlocker("gone")
    }
  }, [listing, listingStillPresent])

  const resolveErrorMessage = useCallback(
    (result: DestashApiResult, fallback: string) => {
      if (result.networkError) return t("networkError")
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

  const applyFailureKind = useCallback((result: DestashApiResult) => {
    const kind = classifyDestashEditFailure(result)
    if (kind === "gone" || kind === "forbidden") {
      setBlocker(kind)
    }
    return kind
  }, [])

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
    [addToFormData, apiBasePath]
  )

  const applyUpdated = useCallback(
    (updated: UserPerfumeI) => {
      onListingUpdated(updated as unknown as UserPerfumeForClient)
      setSnapshot(prev =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev
      )
    },
    [onListingUpdated]
  )

  const handleDecantConfirm = useCallback(
    async (data: DeStashData) => {
      if (!listing || !snapshot || submitLockRef.current || blocker) return
      if (mode === "create" && !sourceBottleId && isFirstListingForPerfume) return
      submitLockRef.current = true
      setFormSubmitting(true)
      setFormError(null)

      const payload = toDestashListingSubmitPayload(data)
      const formData = new FormData()
      formData.append("perfumeId", listing.perfumeId)
      formData.append("amount", payload.amount)
      appendDestashListingFields(formData, payload)

      if (mode === "create") {
        if (isFirstListingForPerfume && sourceBottleId) {
          formData.append("action", "decant")
          formData.append("userPerfumeId", sourceBottleId)
        } else {
          formData.append("action", "create-decant")
        }
      } else {
        formData.append("action", "decant")
        formData.append("userPerfumeId", listing.id)
      }

      try {
        const result = await postDestash(formData)
        if (result.success && result.userPerfume) {
          applyUpdated(result.userPerfume)
          setFormError(null)
          onClosedAfterSuccess?.()
          return
        }
        const kind = applyFailureKind(result)
        if (kind === "generic") {
          // Keep DeStashForm draft values + photos (local form state untouched).
          setFormError(resolveErrorMessage(result, t("saveFailed")))
        } else {
          setFormError(
            kind === "forbidden" ? t("editForbidden") : t("editListingGone")
          )
        }
      } finally {
        submitLockRef.current = false
        setFormSubmitting(false)
      }
    },
    [
      applyFailureKind,
      applyUpdated,
      blocker,
      isFirstListingForPerfume,
      listing,
      mode,
      onClosedAfterSuccess,
      postDestash,
      resolveErrorMessage,
      snapshot,
      sourceBottleId,
      t,
    ]
  )

  const handlePause = useCallback(async () => {
    if (
      mode === "create" ||
      !listing ||
      !snapshot ||
      pauseLockRef.current ||
      submitLockRef.current ||
      blocker
    ) {
      return
    }
    if (parseMl(snapshot.available) <= 0) return

    pauseLockRef.current = true
    setIsPausing(true)
    setFormError(null)

    const previous = { ...snapshot }
    const pausedSnapshot = snapshot.available
    applyUpdated({
      ...snapshot,
      available: "0",
      pausedAvailable: pausedSnapshot,
    })

    const formData = new FormData()
    formData.append("action", "decant")
    formData.append("userPerfumeId", listing.id)
    formData.append("perfumeId", listing.perfumeId)
    formData.append("amount", "0")

    try {
      const result = await postDestash(formData)
      if (result.success) {
        if (result.userPerfume) {
          applyUpdated({
            ...result.userPerfume,
            available: "0",
            pausedAvailable:
              result.userPerfume.pausedAvailable ?? pausedSnapshot,
          })
        }
        onClosedAfterSuccess?.()
        return
      }
      applyUpdated(previous)
      const kind = applyFailureKind(result)
      if (kind === "generic") {
        setFormError(resolveErrorMessage(result, t("pauseFailed")))
      } else {
        setFormError(
          kind === "forbidden" ? t("editForbidden") : t("editListingGone")
        )
      }
    } finally {
      pauseLockRef.current = false
      setIsPausing(false)
    }
  }, [
    applyFailureKind,
    applyUpdated,
    blocker,
    listing,
    mode,
    onClosedAfterSuccess,
    postDestash,
    resolveErrorMessage,
    snapshot,
    t,
  ])

  return {
    snapshot,
    formSubmitting,
    isPausing,
    formError,
    blocker,
    handleDecantConfirm,
    handlePause,
  }
}
