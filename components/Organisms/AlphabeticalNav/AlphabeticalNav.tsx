import { Button } from "@/components/Atoms/Button/Button"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import {
  prefetchHousesByLetter,
  prefetchPerfumesByLetter,
} from "@/lib/utils/prefetch"
import { getAlphabetLetters } from "@/utils/sortUtils"

interface AlphabeticalNavProps {
  selectedLetter: string | null
  onLetterSelect: (letter: string | null) => void
  className?: string
  prefetchType?: "houses" | "perfumes"
  houseType?: string
  pageSize?: number
}

const ALL_BUTTON_KEY = "__all__"
const LETTER_CHANGE_ANIMATION_MS = 560

const AlphabeticalNav = ({
  selectedLetter,
  onLetterSelect,
  className = "",
  prefetchType,
  houseType = "all",
  pageSize = 16,
}: AlphabeticalNavProps) => {
  const t = useTranslations("common")
  const letters = getAlphabetLetters()
  const selectedKey = selectedLetter ?? ALL_BUTTON_KEY
  const [animatedKey, setAnimatedKey] = useState(selectedKey)
  const sharedSelectedButtonClassName =
    "bg-noir-gold text-noir-black hover:bg-noir-gold border-noir-gold-100 shadow-[0_0_0_1px_rgba(255,247,204,0.28),0_16px_30px_rgba(212,175,55,0.22)] -translate-y-0.5"
  const selectedButtonClassName =
    `${sharedSelectedButtonClassName} scale-[1.04]`
  const allSelectedButtonClassName =
    `min-w-[4.75rem] ${sharedSelectedButtonClassName} scale-[1.03]`
  const idleButtonClassName = "motion-safe:hover:-translate-y-0.5"
  const allIdleButtonClassName = "min-w-[4.75rem] motion-safe:hover:-translate-y-0.5"
  const labelClassName =
    "relative z-10 transition-transform duration-300 ease-out group-hover:scale-105"
  const overlayClassName =
    "pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/20 via-transparent to-noir-black/10 " +
    "transition-opacity duration-300"
  const indicatorClassName =
    "pointer-events-none absolute inset-x-3 bottom-1.5 h-[2px] rounded-full bg-noir-black/70 transition-[opacity,transform] duration-300 ease-out"

  useEffect(() => {
    setAnimatedKey(selectedKey)

    const timeoutId = window.setTimeout(() => {
      setAnimatedKey(current => (current === selectedKey ? "" : current))
    }, LETTER_CHANGE_ANIMATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [selectedKey])

  const handleMouseEnter = (letter: string) => {
    if (selectedLetter === letter || !prefetchType) {
      return
    }

    if (prefetchType === "houses") {
      prefetchHousesByLetter(letter, houseType, pageSize).catch(() => {
      })
    } else if (prefetchType === "perfumes") {
      prefetchPerfumesByLetter(letter, houseType, pageSize).catch(() => {
      })
    }
  }

  const renderLetterButton = (
    key: string,
    label: string,
    onClick: () => void,
    onMouseEnter?: () => void
  ) => {
    const isAllButton = key === ALL_BUTTON_KEY
    const isSelected = selectedKey === key
    const isAnimating = animatedKey === key

    return (
      <Button
        key={key}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        aria-pressed={isSelected}
        size={null}
        variant="alphabeticalNav"
        className={`${
          isSelected
            ? isAllButton
              ? allSelectedButtonClassName
              : selectedButtonClassName
            : isAllButton
              ? allIdleButtonClassName
              : idleButtonClassName
        } flex items-center justify-center ${
          isAnimating ? "motion-safe:animate-vault-stamp" : ""
        }`}
      >
        <span
          aria-hidden
          className={`${overlayClassName} ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
          }`}
        />
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-[3px] rounded-[inherit] border transition-opacity duration-300 ${
            isSelected
              ? "border-noir-black/30 opacity-100"
              : "border-noir-gold/15 opacity-0 group-hover:opacity-100"
          }`}
        />
        {isAllButton && (
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-2 top-1.5 h-px rounded-full bg-noir-black/25 transition-opacity duration-300 ${
              isSelected ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
        {isAnimating && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[-30%] w-1/3 rotate-12 bg-white/35 blur-md motion-safe:animate-vault-sweep"
          />
        )}
        <span
          aria-hidden
          className={`${indicatorClassName} ${
            isSelected ? "opacity-100 scale-x-100" : "opacity-0 scale-x-60"
          }`}
        />
        <span
          className={`${labelClassName} ${isSelected ? "tracking-[0.08em] scale-[1.02]" : ""} ${
            isAllButton
              ? "text-sm uppercase tracking-[0.2em]"
              : label.length === 1
                ? "lg:text-2xl"
                : ""
          }`}
        >
          {label}
        </span>
      </Button>
    )
  }

  return (
    <div
      className={`grid grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-4 justify-center mt-10 md:mb-14 ${className}`}
    >
      {renderLetterButton(
        ALL_BUTTON_KEY,
        t("all"),
        () => onLetterSelect(null)
      )}

      {letters.map(letter =>
        renderLetterButton(
          letter,
          letter,
          () => onLetterSelect(letter),
          () => handleMouseEnter(letter)
        )
      )}
    </div>
  )
}

export default AlphabeticalNav
