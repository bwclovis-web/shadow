const DRAG_ANIMATION_DURATION = 0
const IDLE_ANIMATION_DURATION = 0.3
const SCALE_ANIMATION_DURATION = 0.2
const HOVER_SCALE = 1.2
const EASE = "power2.out"

/**
 * Clamps a value between min and max
 */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/**
 * Calculates the percentage position of a value within a range
 */
export const calculatePercentage = (
  value: number,
  min: number,
  max: number
): number => ((value - min) / (max - min)) * 100

/**
 * Calculates a value from a mouse position within a track element
 */
export const calculateValueFromPosition = ({
  clientX,
  trackElement,
  min,
  max,
  step,
}: {
  clientX: number
  trackElement: HTMLElement
  min: number
  max: number
  step: number
}): number => {
  const rect = trackElement.getBoundingClientRect()
  if (rect.width === 0) return min
  const newPercentage = clamp((clientX - rect.left) / rect.width, 0, 1)
  const rawValue = min + newPercentage * (max - min)
  const steppedValue = Math.round(rawValue / step) * step
  return clamp(steppedValue, min, max)
}

/**
 * Handles keyboard navigation for slider
 */
export const getKeyboardValue = ({
  key,
  currentValue,
  min,
  max,
  step,
}: {
  key: string
  currentValue: number
  min: number
  max: number
  step: number
}): number | null => {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(min, currentValue - step)
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(max, currentValue + step)
    case "Home":
      return min
    case "End":
      return max
    default:
      return null
  }
}

/**
 * Animation utilities for slider elements
 */
const tweenConfig = (duration: number) => ({ duration, ease: EASE })

export const sliderAnimations = {
  animatePosition: async (
    thumbElement: HTMLElement,
    fillElement: HTMLElement,
    percentage: number,
    isDragging: boolean
  ) => {
    const { gsap } = await import("gsap")
    const duration = isDragging ? DRAG_ANIMATION_DURATION : IDLE_ANIMATION_DURATION
    const config = tweenConfig(duration)

    gsap.to(thumbElement, { x: `${percentage}%`, ...config })
    gsap.to(fillElement, { width: `${percentage}%`, ...config })
  },

  animateScale: async (
    element: HTMLElement,
    scale: number,
    duration = SCALE_ANIMATION_DURATION
  ) => {
    const { gsap } = await import("gsap")
    gsap.to(element, { scale, ...tweenConfig(duration) })
  },
}

/**
 * Sets up hover animations for slider thumb
 */
export const setupHoverListeners = (
  thumbElement: HTMLElement,
  disabled: boolean,
  isDragging: boolean
): (() => void) => {
  const handleMouseEnter = () => {
    if (!disabled) void sliderAnimations.animateScale(thumbElement, HOVER_SCALE)
  }

  const handleMouseLeave = () => {
    if (!isDragging && !disabled)
      void sliderAnimations.animateScale(thumbElement, 1)
  }

  thumbElement.addEventListener("mouseenter", handleMouseEnter)
  thumbElement.addEventListener("mouseleave", handleMouseLeave)

  return () => {
    thumbElement.removeEventListener("mouseenter", handleMouseEnter)
    thumbElement.removeEventListener("mouseleave", handleMouseLeave)
  }
}
