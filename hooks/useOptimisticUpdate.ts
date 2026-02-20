import { useCallback, useEffect, useState } from "react"

export interface UseOptimisticUpdateOptions<T> {
  initialData: T
  onUpdate: (data: T) => Promise<T>
  onError?: (error: unknown, originalData: T) => void
  onSuccess?: (updatedData: T) => void
  revertOnError?: boolean
}

export interface UseOptimisticUpdateReturn<T> {
  data: T
  isUpdating: boolean
  error: unknown | null
  updateData: (newData: T) => Promise<void>
  revertData: () => void
  clearError: () => void
}

/**
 * Custom hook for managing optimistic updates with rollback capability
 *
 * @param options - Configuration options for optimistic updates
 * @returns Optimistic update state and handlers
 */
export const useOptimisticUpdate = <T>({
  initialData,
  onUpdate,
  onError,
  onSuccess,
  revertOnError = true,
}: UseOptimisticUpdateOptions<T>): UseOptimisticUpdateReturn<T> => {
  const [data, setData] = useState<T>(initialData)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<unknown | null>(null)
  const [originalData, setOriginalData] = useState<T>(initialData)

  // Update data when initialData changes
  useEffect(() => {
    setData(initialData)
    setOriginalData(initialData)
  }, [initialData])

  const updateData = useCallback(
    async (newData: T) => {
      if (isUpdating) {
        return
      }

      const previousData = data
      setOriginalData(previousData)
      setData(newData)
      setError(null)
      setIsUpdating(true)

      try {
        const result = await onUpdate(newData)
        setData(result)
        setOriginalData(result)
        onSuccess?.(result)
      } catch (err) {
        setError(err)
        onError?.(err, previousData)

        if (revertOnError) {
          setData(previousData)
        }
      } finally {
        setIsUpdating(false)
      }
    },
    [
data, isUpdating, onUpdate, onSuccess, onError, revertOnError
]
  )

  const revertData = useCallback(() => {
    setData(originalData)
    setError(null)
  }, [originalData])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    data,
    isUpdating,
    error,
    updateData,
    revertData,
    clearError,
  }
}

export default useOptimisticUpdate
