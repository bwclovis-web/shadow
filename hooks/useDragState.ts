import React, { useCallback, useRef, useState } from "react"

import { sliderAnimations } from "@/utils/rangeSliderUtils"

interface UseDragStateOptions {
  onValueChange: (value: number) => void
  calculateValue: (clientX: number) => number
  thumbRef: React.RefObject<HTMLDivElement | null>
}

export const useDragState = ({
  onValueChange,
  calculateValue,
  thumbRef,
}: UseDragStateOptions) => {
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseMove = useCallback(
    (event: Event) => {
      if (!isDraggingRef.current) {
        return
      }
      const mouseEvent = event as globalThis.MouseEvent
      const newValue = calculateValue(mouseEvent.clientX)
      onValueChange(newValue)
    },
    [calculateValue, onValueChange]
  )

  const handleTouchMove = useCallback(
    (event: Event) => {
      if (!isDraggingRef.current) {
        return
      }
      // Prevent scrolling while dragging the slider
      event.preventDefault()
      const touchEvent = event as globalThis.TouchEvent
      if (touchEvent.touches.length > 0) {
        const touch = touchEvent.touches[0]
        const newValue = calculateValue(touch.clientX)
        onValueChange(newValue)
      }
    },
    [calculateValue, onValueChange]
  )

  const handleMouseUpRef = useRef<() => void>(() => {})
  const mouseUpWrapperRef = useRef<() => void>(() => {})

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) {
      return
    }
    isDraggingRef.current = false
    setIsDragging(false)
    if (thumbRef.current) {
      void sliderAnimations.animateScale(thumbRef.current, 1.2)
    }
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", mouseUpWrapperRef.current)
    document.removeEventListener("touchmove", handleTouchMove)
    document.removeEventListener("touchend", mouseUpWrapperRef.current)
    document.removeEventListener("touchcancel", mouseUpWrapperRef.current)
  }, [handleMouseMove, handleTouchMove, thumbRef])

  const startDragging = useCallback(
    (clientX: number) => {
      handleMouseUpRef.current = handleMouseUp
      isDraggingRef.current = true
      setIsDragging(true)

      const newValue = calculateValue(clientX)
      onValueChange(newValue)

      if (thumbRef.current) {
        void sliderAnimations.animateScale(thumbRef.current, 1.3, 0.1)
      }

      const mouseUpWrapper = () => handleMouseUpRef.current()
      mouseUpWrapperRef.current = mouseUpWrapper

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", mouseUpWrapper)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", mouseUpWrapper)
      document.addEventListener("touchcancel", mouseUpWrapper)
    },
    [
      calculateValue,
      onValueChange,
      handleMouseMove,
      handleTouchMove,
      handleMouseUp,
      thumbRef,
    ]
  )

  return {
    isDragging,
    startDragging,
  }
}
