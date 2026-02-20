import { Button } from "~/components/Atoms/Button/Button"
import {
  prefetchHousesByLetter,
  prefetchPerfumesByLetter,
} from "~/lib/utils/prefetch"
import { getAlphabetLetters } from "~/utils/sortUtils"

interface AlphabeticalNavProps {
  selectedLetter: string | null
  onLetterSelect: (letter: string | null) => void
  className?: string
  prefetchType?: "houses" | "perfumes"
  houseType?: string
}

const AlphabeticalNav = ({
  selectedLetter,
  onLetterSelect,
  className = "",
  prefetchType,
  houseType = "all",
}: AlphabeticalNavProps) => {
  const letters = getAlphabetLetters()

  const handleMouseEnter = (letter: string) => {
    // Only prefetch if not already selected and prefetchType is specified
    if (selectedLetter === letter || !prefetchType) {
      return
    }

    // Prefetch on hover for better UX
    if (prefetchType === "houses") {
      prefetchHousesByLetter(letter, houseType).catch(() => {
        // Silently fail - prefetch is just an optimization
      })
    } else if (prefetchType === "perfumes") {
      prefetchPerfumesByLetter(letter, houseType).catch(() => {
        // Silently fail - prefetch is just an optimization
      })
    }
  }

  return (
    <div
      className={`grid grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-4 justify-center inner-container mt-10 md:mb-18 ${className}`}
    >
      <Button
        onClick={() => onLetterSelect(null)}
        className={`px-3 py-2 rounded-md font-medium transition-colors relative ${
          selectedLetter === null
            ? "bg-noir-gold text-noir-black"
            : "bg-noir-dark text-noir-gold hover:bg-noir-gold/20 noir-outline"
        }`}
      >
        All
      </Button>

      {letters.map(letter => (
        <Button
          key={letter}
          onClick={() => onLetterSelect(letter)}
          onMouseEnter={() => handleMouseEnter(letter)}
          className={`px-3 py-2 rounded-md font-medium transition-colors flex items-center justify-center relative ${
            selectedLetter === letter
              ? "bg-noir-gold text-noir-black"
              : "bg-noir-dark text-noir-gold hover:bg-noir-gold/20 noir-outline"
          }`}
        >
          <span className="lg:text-2xl">{letter}</span>
        </Button>
      ))}
    </div>
  )
}

export default AlphabeticalNav
