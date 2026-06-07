"use client"

import { useState } from "react"

import { useSessionStore } from "@/hooks/sessionStore"

type UsePhotoLightboxOptions = {
  imageCount: number
  modalId: string
}

export const usePhotoLightbox = ({
  imageCount,
  modalId,
}: UsePhotoLightboxOptions) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const openModal = useSessionStore(state => state.openModal)

  const openLightbox = (index = 0) => {
    if (imageCount === 0) return
    setLightboxIndex(index)
    openModal(modalId)
  }

  const closeLightbox = () => {
    setLightboxIndex(null)
    const { modalId: activeModalId, closeModal } = useSessionStore.getState()
    if (activeModalId === modalId) {
      closeModal()
    }
  }

  const goPrev = () =>
    setLightboxIndex(current =>
      current === null ? null : (current - 1 + imageCount) % imageCount
    )

  const goNext = () =>
    setLightboxIndex(current =>
      current === null ? null : (current + 1) % imageCount
    )

  return {
    lightboxIndex,
    isOpen: lightboxIndex !== null,
    openLightbox,
    closeLightbox,
    goPrev,
    goNext,
    setLightboxIndex,
  }
}
