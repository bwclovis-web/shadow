import { useState } from "react"

export interface UseToggleOptions {
  initialValue?: boolean
  onToggle?: (value: boolean) => void
}

export interface UseToggleReturn {
  value: boolean
  toggle: () => void
  setTrue: () => void
  setFalse: () => void
  setValue: (value: boolean) => void
}

/**
 * Custom hook for managing boolean toggle state
 *
 * @param options - Configuration options for the toggle
 * @returns Toggle state and handlers
 */
export const useToggle = ({
  initialValue = false,
  onToggle,
}: UseToggleOptions = {}): UseToggleReturn => {
  const [value, setValueState] = useState(initialValue)

  const toggle = () => {
    setValueState(prev => {
      const newValue = !prev
      onToggle?.(newValue)
      return newValue
    })
  }

  const setTrue = () => {
    setValueState(true)
    onToggle?.(true)
  }

  const setFalse = () => {
    setValueState(false)
    onToggle?.(false)
  }

  const setValue = (newValue: boolean) => {
    setValueState(newValue)
    onToggle?.(newValue)
  }

  return {
    value,
    toggle,
    setTrue,
    setFalse,
    setValue,
  }
}

export default useToggle
