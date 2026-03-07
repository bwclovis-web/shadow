import { useGSAP } from "@gsap/react"
import React, {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  calculatePercentage,
  calculateValueFromPosition,
  getKeyboardValue,
  setupHoverListeners,
  sliderAnimations,
} from "@/utils/rangeSliderUtils"

import { useDragState } from "./useDragState"

interface UseRangeSliderOptions {
  min?: number
  max?: number
  step?: number
  value?: number
  onChange?: (newValue: number) => void
  disabled?: boolean
}

interface UseRangeSliderReturn {
  // Refs
  trackRef: React.RefObject<HTMLDivElement | null>
  fillRef: React.RefObject<HTMLDivElement | null>
  thumbRef: React.RefObject<HTMLDivElement | null>

  // State
  isDragging: boolean
  internalValue: number
  percentage: number

  // Event handlers
  handleMouseDown: (event: ReactMouseEvent) => void
  handleTouchStart: (event: ReactTouchEvent) => void
  handleTrackClick: (event: ReactMouseEvent) => void
  handleTrackTouch: (event: ReactTouchEvent) => void
  handleKeyDown: (event: ReactKeyboardEvent) => void
}

export const useRangeSlider = ({
  min = 0,
  max = 100,
  step = 1,
  value = 0,
  onChange,
  disabled = false,
}: UseRangeSliderOptions): UseRangeSliderReturn => {
  const trackRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const [internalValue, setInternalValue] = useState(value)

  const percentage = calculatePercentage(internalValue, min, max)

  const updateValue = useCallback(
    (newValue: number) => {
      setInternalValue(newValue)
      onChange?.(newValue)
    },
    [onChange]
  )

  const calculateValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min
      return calculateValueFromPosition({
        clientX,
        trackElement: trackRef.current,
        min,
        max,
        step,
      })
    },
    [min, max, step]
  )

  const { isDragging, startDragging } = useDragState({
    onValueChange: updateValue,
    calculateValue,
    thumbRef,
  })

  useGSAP(async () => {
    if (thumbRef.current && fillRef.current) {
      await sliderAnimations.animatePosition(
        thumbRef.current,
        fillRef.current,
        percentage,
        isDragging
      )
    }
  }, [percentage, isDragging])

  useGSAP(() => {
    if (!thumbRef.current) return
    return setupHoverListeners(thumbRef.current, disabled, isDragging)
  }, [disabled, isDragging])

  const handleMouseDown = (event: ReactMouseEvent) => {
    if (disabled) return
    event.preventDefault()
    startDragging(event.clientX)
  }

  const handleTouchStart = (event: ReactTouchEvent) => {
    if (disabled || event.touches.length === 0) return
    event.preventDefault()
    startDragging(event.touches[0].clientX)
  }

  const handleTrackClick = (event: ReactMouseEvent) => {
    if (disabled || event.target === thumbRef.current) {
      return
    }
    const newValue = calculateValue(event.clientX)
    updateValue(newValue)
  }

  const handleTrackTouch = (event: ReactTouchEvent) => {
    if (
      disabled ||
      event.touches.length === 0 ||
      event.target === thumbRef.current
    ) {
      return
    }
    event.preventDefault() // Prevent scrolling
    const newValue = calculateValue(event.touches[0].clientX)
    updateValue(newValue)
  }

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (disabled) {
      return
    }

    const newValue = getKeyboardValue({
      key: event.key,
      currentValue: internalValue,
      min,
      max,
      step,
    })
    if (newValue !== null) {
      event.preventDefault()
      updateValue(newValue)
    }
  }

  // Sync external value when not dragging (avoid overwriting user input)
  useEffect(() => {
    if (!isDragging) setInternalValue(value)
  }, [value, isDragging])

  return {
    trackRef,
    fillRef,
    thumbRef,
    isDragging,
    internalValue,
    percentage,
    handleMouseDown,
    handleTouchStart,
    handleTrackClick,
    handleTrackTouch,
    handleKeyDown,
  }
}
