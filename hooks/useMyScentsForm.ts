import { useCallback, useEffect, useState } from "react"

import { useCSRF } from "@/hooks/useCSRF"
import type { UserPerfumeI } from "@/types"

// Helper functions to get initial state values
function getInitialPerfumeState(initialPerfume?: UserPerfumeI) {
  return initialPerfume || null
}

const getInitialPerfumeData = (initialPerfume?: UserPerfumeI) => ({
  amount: initialPerfume?.amount || "",
  price: initialPerfume?.price || "",
  placeOfPurchase: initialPerfume?.placeOfPurchase || "",
  type: initialPerfume?.type || "",
})

const MY_SCENTS_API = "/api/user-perfumes"

// Custom hook to manage perfume form state
export const useMyScentsForm = (
  initialPerfume?: UserPerfumeI,
  onSuccess?: () => void
) => {
  const { submitForm } = useCSRF()

  // Initialize state with helper functions
  const [selectedPerfume, setSelectedPerfume] = useState<UserPerfumeI | null>(getInitialPerfumeState(initialPerfume))
  const initialData = getInitialPerfumeData(initialPerfume)
  const [perfumeData, setPerfumeData] = useState(initialData)

  // Define callbacks
  const resetForm = useCallback(() => {
    setSelectedPerfume(null)
    setPerfumeData({ amount: "", price: "", placeOfPurchase: "", type: "" })
  }, [])

  const handleClick = useCallback((item: UserPerfumeI) => {
    setSelectedPerfume(item)
    setPerfumeData({
      amount: item.amount || "",
      price: item.price || "",
      placeOfPurchase: item.placeOfPurchase || "",
      type: item.type || "",
    })
  }, [])

  const createFormData = useCallback(() => {
    if (!selectedPerfume) return null
    const perfumeId =
      "perfumeId" in selectedPerfume && selectedPerfume.perfumeId
        ? selectedPerfume.perfumeId
        : selectedPerfume.id
    const formData = new FormData()
    formData.append("perfumeId", perfumeId)
    formData.append("amount", perfumeData.amount)
    formData.append("price", perfumeData.price)
    formData.append("placeOfPurchase", perfumeData.placeOfPurchase)
    formData.append("action", "add")
    return formData
  }, [selectedPerfume, perfumeData])

  const handleAddPerfume = useCallback(
    async (evt: React.FormEvent) => {
      evt.preventDefault()
      const formData = createFormData()
      if (!formData) return
      const response = await submitForm(MY_SCENTS_API, formData)
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.success) {
        resetForm()
        onSuccess?.()
      }
    },
    [createFormData, resetForm, submitForm, onSuccess]
  )

  // Update state when perfume changes
  useEffect(() => {
    if (initialPerfume) {
      setSelectedPerfume(initialPerfume)
      setPerfumeData({
        amount: initialPerfume.amount || "",
        price: initialPerfume.price || "",
        placeOfPurchase: initialPerfume.placeOfPurchase || "",
        type: initialPerfume.type || "",
      })
    }
  }, [initialPerfume])

  return {
    selectedPerfume,
    perfumeData,
    setPerfumeData,
    handleClick,
    handleAddPerfume,
  }
}
