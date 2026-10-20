"use client"

import { useEffect, useState } from "react"

import { useSessionStore } from "@/hooks/sessionStore"
import {
  useToggleWishlist,
  type WishlistBottlePreference,
} from "@/lib/mutations/wishlist"

type WishlistItemLike = {
  id: string
  isPublic: boolean
  bottlePreference?: WishlistBottlePreference | null
  perfume: { id: string; name: string }
}

type Options = {
  onRemove?: () => void
  onVisibilityChange?: () => void
  actionErrorFallback: string
}

export const useWishlistItemControls = (
  item: WishlistItemLike,
  options: Options
) => {
  const [isPublic, setIsPublic] = useState(Boolean(item.isPublic))
  const [bottlePreference, setBottlePreference] = useState<WishlistBottlePreference>(
    item.bottlePreference ?? "any"
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const toggleWishlist = useToggleWishlist()
  const { modalOpen, modalId, openModal, closeModal } = useSessionStore()
  const removeModalId = `seeking-remove-${item.id}`
  const perfumeId = item.perfume.id
  const pending = toggleWishlist.isPending

  useEffect(() => {
    setIsPublic(Boolean(item.isPublic))
  }, [item.isPublic])

  useEffect(() => {
    setBottlePreference(item.bottlePreference ?? "any")
  }, [item.bottlePreference])

  const handleConfirmRemove = () => {
    setActionError(null)
    toggleWishlist.mutate(
      { perfumeId, action: "remove" },
      {
        onSuccess: () => {
          closeModal()
          options.onRemove?.()
        },
        onError: error => {
          setActionError(
            error instanceof Error ? error.message : options.actionErrorFallback
          )
          closeModal()
        },
      }
    )
  }

  const handleBottlePreferenceChange = (next: WishlistBottlePreference) => {
    if (next === bottlePreference || pending) return
    setActionError(null)
    const previous = bottlePreference
    setBottlePreference(next)
    toggleWishlist.mutate(
      {
        perfumeId,
        action: "updateBottlePreference",
        bottlePreference: next,
      },
      {
        onError: error => {
          setBottlePreference(previous)
          setActionError(
            error instanceof Error ? error.message : options.actionErrorFallback
          )
        },
      }
    )
  }

  const handleVisibilityToggle = () => {
    if (pending) return
    const next = !isPublic
    setActionError(null)
    setIsPublic(next)
    toggleWishlist.mutate(
      {
        perfumeId,
        action: "updateVisibility",
        isPublic: next,
      },
      {
        onSuccess: () => {
          options.onVisibilityChange?.()
        },
        onError: error => {
          setIsPublic(!next)
          setActionError(
            error instanceof Error ? error.message : options.actionErrorFallback
          )
        },
      }
    )
  }

  return {
    isPublic,
    bottlePreference,
    actionError,
    pending,
    removeModalId,
    removeModalOpen: modalOpen && modalId === removeModalId,
    openRemoveModal: () => openModal(removeModalId),
    handleConfirmRemove,
    handleBottlePreferenceChange,
    handleVisibilityToggle,
  }
}
