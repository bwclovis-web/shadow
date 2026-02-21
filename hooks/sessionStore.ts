import { type RefObject } from "react"
import { create } from "zustand"

interface ModalData {
  [key: string]: unknown
}

interface SessionState {
  modalOpen: boolean
  modalData: ModalData | null
  modalId: string | null
  triggerId: RefObject<HTMLButtonElement> | null

  // Actions
  toggleModal: (
    id: RefObject<HTMLButtonElement | null>,
    modalId: string,
    data?: ModalData
  ) => void
  closeModal: () => void
  setModalData: (data: ModalData | null) => void
  setModalId: (id: string | null) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  modalOpen: false,
  modalData: null,
  modalId: null,
  triggerId: null,

  toggleModal: (
    id: RefObject<HTMLButtonElement>,
    modalId: string,
    data?: ModalData
  ) => {
    const { modalOpen, modalId: currentModalId } = get()

    // If the same modal is already open, close it
    if (modalOpen && currentModalId === modalId) {
      set({
        modalOpen: false,
        modalId: null,
        modalData: null,
        triggerId: null,
      })
      document.documentElement.style.overflow = "auto"
      id.current?.focus()
      return
    }

    // Open the new modal
    set({
      modalOpen: true,
      modalId,
      modalData: data || null,
      triggerId: id,
    })

    // Handle body overflow
    document.documentElement.style.overflow = "hidden"
  },

  closeModal: () => {
    set({
      modalOpen: false,
      modalId: null,
      modalData: null,
      triggerId: null,
    })

    // Restore body overflow
    const root = document.documentElement
    root.style.overflow = "auto"
  },

  setModalData: (data: ModalData | null) => {
    set({ modalData: data })
  },

  setModalId: (id: string | null) => {
    set({ modalId: id })
  },
}))
