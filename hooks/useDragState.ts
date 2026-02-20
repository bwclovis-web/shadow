import React, { useCallback, useRef } from "react"

import { sliderAnimations } from "~/utils/rangeSliderUtils"

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

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) {
      return
    }
    isDraggingRef.current = false
    if (thumbRef.current) {
      sliderAnimations.animateScale(thumbRef.current, 1.2)
    }
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
    // Clean up touch events as well
    document.removeEventListener("touchmove", handleTouchMove)
    document.removeEventListener("touchend", handleMouseUp)
    document.removeEventListener("touchcancel", handleMouseUp)
  }, [handleMouseMove, handleTouchMove, thumbRef])

  const startDragging = useCallback(
    (clientX: number) => {
      isDraggingRef.current = true

      const newValue = calculateValue(clientX)
      onValueChange(newValue)

      if (thumbRef.current) {
        sliderAnimations.animateScale(thumbRef.current, 1.3, 0.1)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      // Add touch event listeners
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      })
      document.addEventListener("touchend", handleMouseUp)
      document.addEventListener("touchcancel", handleMouseUp)
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
    isDragging: isDraggingRef.current,
    startDragging,
  }
}
