 import { type VariantProps } from "class-variance-authority"
import { type HTMLAttributes, useEffect, useState } from "react"

import { useRangeSlider } from "@/hooks/useRangeSlider"
import { styleMerge } from "@/utils/styleUtils"

import {
  rangeSliderFillVariants,
  rangeSliderMaxVariants,
  rangeSliderVariants,
  rangeSliderWrapVariants,
} from "./rangeSlider-variants"

const formatDisplay = (value: number, formatValue?: (value: number) => string) =>
  formatValue ? formatValue(value) : value.toString()

const thumbBaseClasses =
  "absolute top-1/2 w-8 h-8 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center cursor-pointer transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
const thumbKnobClasses =
  "w-5 h-5 bg-white border-2 border-noir-gold rounded-full shadow-md"
const focusRingClasses =
  "absolute top-1/2 w-6 h-6 -translate-y-1/2 -translate-x-1/2 border-2 border-transparent rounded-full transition-all pointer-events-none"
const inputBaseClasses =
  "w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"

interface RangeSliderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof rangeSliderWrapVariants> {
  min?: number
  max?: number
  step?: number
  value?: number
  onChange?: (value: number) => void
  disabled?: boolean
  label?: string
  formatValue?: (value: number) => string
  showManualInput?: boolean
  inputPlaceholder?: string
}

const RangeSlider = ({
  className,
  min = 0,
  max = 100,
  step = 1,
  value = 0,
  onChange,
  disabled = false,
  label,
  formatValue,
  size = "medium",
  showManualInput = false,
  inputPlaceholder,
  ...restProps
}: RangeSliderProps) => {
  const {
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
  } = useRangeSlider({
    min,
    max,
    step,
    value,
    onChange,
    disabled,
  })

  const [inputValue, setInputValue] = useState(() =>
    formatDisplay(internalValue, formatValue)
  )
  const [isInputFocused, setIsInputFocused] = useState(false)

  useEffect(() => {
    if (!isInputFocused) {
      setInputValue(formatDisplay(internalValue, formatValue))
    }
  }, [internalValue, isInputFocused, formatValue])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }

  const handleInputBlur = () => {
    setIsInputFocused(false)
    const numericValue = parseFloat(inputValue)

    if (!isNaN(numericValue)) {
      const clampedValue = Math.min(Math.max(numericValue, min), max)
      const steppedValue = Math.round(clampedValue / step) * step
      if (steppedValue !== internalValue) {
        onChange?.(steppedValue)
      }
      setInputValue(formatDisplay(steppedValue, formatValue))
    } else {
      setInputValue(formatDisplay(internalValue, formatValue))
    }
  }

  const handleInputFocus = () => setIsInputFocused(true)

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur()
  }

  return (
    <div className="w-full space-y-2 text-noir-dark">
      {label && (
        <div className="flex justify-between items-center text-md">
          <span>{label}</span>
          <span className="font-medium">
            {formatValue ? formatValue(internalValue) : `${internalValue}ml`}
          </span>
        </div>
      )}

      <div
        className={styleMerge(rangeSliderWrapVariants({ size, className }))}
        data-cy="RangeSlider"
        {...restProps}
      >
        <div
          ref={trackRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={internalValue}
          aria-disabled={disabled}
          className={styleMerge(rangeSliderVariants({ className, theme: "dark" }))}
          onClick={handleTrackClick}
          onTouchStart={handleTrackTouch}
          onKeyDown={handleKeyDown}
        >
          <div
            ref={fillRef}
            className={styleMerge(rangeSliderFillVariants({ className, theme: "light" }))}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div
          ref={thumbRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Slider thumb, current value: ${internalValue}`}
          className={styleMerge(
            thumbBaseClasses,
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onKeyDown={handleKeyDown}
          style={{ left: `${percentage}%` }}
        >
          <div
            className={styleMerge(
              thumbKnobClasses,
              disabled ? "border-gray-400" : "hover:border-noir-gold-100",
              isDragging && "border-noir-gold"
            )}
          />
        </div>

        <div
          className={styleMerge(
            focusRingClasses,
            isDragging && "border-blue-400 scale-150"
          )}
          style={{ left: `${percentage}%` }}
        />
      </div>

      {/* Manual Input Field */}
      {showManualInput && (
        <div className="mt-3">
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            onKeyDown={handleInputKeyDown}
            placeholder={inputPlaceholder || `Enter value (${min}-${max})`}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className={styleMerge(
              inputBaseClasses,
              disabled
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-900"
            )}
          />
        </div>
      )}

      <div
        className={styleMerge(rangeSliderMaxVariants({ className, theme: "light" }))}
      >
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export default RangeSlider
