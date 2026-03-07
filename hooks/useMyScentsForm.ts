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

export type OptimisticCollectionItem = {
  tempId: string
  perfumeId: string
  amount: string
  price: string
  placeOfPurchase: string
  type: string
  perfume: {
    id: string
    name: string
    image?: string
    description?: string
    slug?: string
    perfumeHouse?: {
      id: string
      name: string
      slug?: string
    }
  }
}

type OptimisticCallbacks = {
  onOptimisticAdd?: (item: OptimisticCollectionItem) => void
  onOptimisticAddRollback?: (tempId: string) => void
}

const getOptimisticPerfumeDetails = (
  perfume: UserPerfumeI
): OptimisticCollectionItem["perfume"] => {
  if ("perfume" in perfume && perfume.perfume) {
    return {
      id: perfume.perfume.id,
      name: perfume.perfume.name,
      image: perfume.perfume.image,
      description: perfume.perfume.description,
      slug: (perfume.perfume as { slug?: string }).slug,
      perfumeHouse: perfume.perfume.perfumeHouse
        ? {
            id: perfume.perfume.perfumeHouse.id,
            name: perfume.perfume.perfumeHouse.name,
            slug: (perfume.perfume.perfumeHouse as { slug?: string }).slug,
          }
        : undefined,
    }
  }

  const fallbackPerfume = perfume as UserPerfumeI & {
    name?: string
    image?: string
    description?: string
    slug?: string
    perfumeHouse?: { id: string; name: string; slug?: string }
  }

  return {
    id: fallbackPerfume.id,
    name: fallbackPerfume.name ?? "",
    image: fallbackPerfume.image,
    description: fallbackPerfume.description,
    slug: fallbackPerfume.slug,
    perfumeHouse: fallbackPerfume.perfumeHouse,
  }
}

// Custom hook to manage perfume form state
export const useMyScentsForm = (
  initialPerfume?: UserPerfumeI,
  onSuccess?: () => void,
  optimisticCallbacks?: OptimisticCallbacks
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
    if (perfumeData.type) {
      formData.append("type", perfumeData.type)
    }
    formData.append("action", "add")
    return formData
  }, [selectedPerfume, perfumeData])

  const handleAddPerfume = useCallback(
    async (evt: React.FormEvent) => {
      evt.preventDefault()
      const formData = createFormData()
      if (!formData) return
      const optimisticPerfume = selectedPerfume
        ? getOptimisticPerfumeDetails(selectedPerfume)
        : null
      const optimisticPerfumeId = optimisticPerfume?.id ?? selectedPerfume?.id ?? "unknown"
      const optimisticId = `optimistic-${optimisticPerfumeId}-${Date.now()}`

      if (optimisticPerfume) {
        optimisticCallbacks?.onOptimisticAdd?.({
          tempId: optimisticId,
          perfumeId: formData.get("perfumeId")?.toString() || optimisticPerfume.id,
          amount: perfumeData.amount,
          price: perfumeData.price,
          placeOfPurchase: perfumeData.placeOfPurchase,
          type: perfumeData.type,
          perfume: optimisticPerfume,
        })
      }

      try {
        const response = await submitForm(MY_SCENTS_API, formData)
        const data = await response.json().catch(() => ({}))

        if (response.ok && data?.success) {
          resetForm()
          onSuccess?.()
          return
        }

        optimisticCallbacks?.onOptimisticAddRollback?.(optimisticId)
      } catch {
        optimisticCallbacks?.onOptimisticAddRollback?.(optimisticId)
      }
    },
    [
      createFormData,
      resetForm,
      submitForm,
      onSuccess,
      selectedPerfume,
      optimisticCallbacks,
      perfumeData.amount,
      perfumeData.placeOfPurchase,
      perfumeData.price,
      perfumeData.type,
    ]
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
