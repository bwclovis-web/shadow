import { useEffect, useState } from "react"

export interface UseLocalStorageOptions<T> {
  key: string
  initialValue: T
  serialize?: (value: T) => string
  deserialize?: (value: string) => T
  storage?: Storage
}

export interface UseLocalStorageReturn<T> {
  value: T
  setValue: (value: T | ((prev: T) => T)) => void
  removeValue: () => void
  clearStorage: () => void
  isLoaded: boolean
}

/**
 * Custom hook for managing localStorage with type safety and error handling
 *
 * @param options - Configuration options for localStorage
 * @returns LocalStorage state and handlers
 */
export const useLocalStorage = <T>({
  key,
  initialValue,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
  storage = typeof window !== "undefined" ? localStorage : undefined,
}: UseLocalStorageOptions<T>): UseLocalStorageReturn<T> => {
  const [value, setValueState] = useState<T>(initialValue)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load value from localStorage on mount
  useEffect(() => {
    if (!storage) {
      setIsLoaded(true)
      return
    }

    try {
      const item = storage.getItem(key)
      if (item !== null) {
        const parsedValue = deserialize(item)
        setValueState(parsedValue)
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
    } finally {
      setIsLoaded(true)
    }
  }, [key, storage, deserialize])

  // Set value in localStorage and state
  const setValue = (newValue: T | ((prev: T) => T)) => {
    try {
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue
      setValueState(valueToStore)

      if (storage) {
        storage.setItem(key, serialize(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }

  // Remove value from localStorage and reset to initial
  const removeValue = () => {
    try {
      setValueState(initialValue)
      if (storage) {
        storage.removeItem(key)
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }

  // Clear all localStorage
  const clearStorage = () => {
    try {
      if (storage) {
        storage.clear()
      }
      setValueState(initialValue)
    } catch (error) {
      console.error("Error clearing localStorage:", error)
    }
  }

  return {
    value,
    setValue,
    removeValue,
    clearStorage,
    isLoaded,
  }
}

export default useLocalStorage
