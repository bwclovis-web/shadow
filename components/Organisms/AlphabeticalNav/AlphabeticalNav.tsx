import { Button } from "@/components/Atoms/Button/Button"
import { useTranslations } from "next-intl"
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
  const selectedButtonClassName = "bg-noir-gold text-noir-black hover:bg-noir-gold"

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

  return (
    <div
      className={`grid grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-4 justify-center mt-10 md:mb-14 ${className}`}
    >
      <Button
        onClick={() => onLetterSelect(null)}
        size={null}
        variant="alphabeticalNav"
        className={selectedLetter === null ? selectedButtonClassName : undefined}
      >
        {t("all")}
      </Button>

      {letters.map(letter => (
        <Button
          key={letter}
          onClick={() => onLetterSelect(letter)}
          onMouseEnter={() => handleMouseEnter(letter)}
          size={null}
          variant="alphabeticalNav"
          className={`${selectedLetter === letter ? selectedButtonClassName : ""} flex items-center justify-center`}
        >
          <span className="lg:text-2xl">{letter}</span>
        </Button>
      ))}
    </div>
  )
}

export default AlphabeticalNav
