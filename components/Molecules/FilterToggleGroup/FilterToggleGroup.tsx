"use client"

import { Button } from "@/components/Atoms/Button/Button"
import { styleMerge } from "@/utils/styleUtils"

export type FilterToggleOption<T extends string> = {
  value: T
  label: string
}

export type FilterToggleGroupProps<T extends string> = {
  options: FilterToggleOption<T>[]
  selected: T[]
  onChange: (next: T[]) => void
  ariaLabel: string
  className?: string
}

export const FilterToggleGroup = <T extends string>({
  options,
  selected,
  onChange,
  ariaLabel,
  className,
}: FilterToggleGroupProps<T>) => {
  const toggle = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={styleMerge("flex flex-wrap gap-2", className)}
    >
      {options.map(opt => {
        const isOn = selected.includes(opt.value)
        return (
          <Button
            key={opt.value}
            type="button"
            variant="secondary"
            size="sm"
            aria-pressed={isOn}
            onClick={() => toggle(opt.value)}
            className={styleMerge(
              "w-auto shrink-0 px-3 py-1.5",
              isOn
                ? "border-noir-gold bg-noir-gold/20 text-noir-gold"
                : "border-noir-light/40 text-noir-gold-100 hover:border-noir-gold/50"
            )}
          >
            {opt.label}
          </Button>
        )
      })}
    </div>
  )
}


