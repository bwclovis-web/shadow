import LinkCard from "~/components/Organisms/LinkCard"
import { groupByFirstLetter, type SortableItem } from "~/utils/sortUtils"

interface DataDisplayProps {
  items: SortableItem[]
  type: "perfume" | "perfume-house"
  selectedLetter: string | null
  className?: string
}

const DataDisplay = ({
  items,
  type,
  selectedLetter,
  className = "",
}: DataDisplayProps) => {
  if (selectedLetter) {
    const letterItems = items.filter(item => item.name.charAt(0).toUpperCase() === selectedLetter)

    return (
      <div className={className}>
        <h2 className="text-2xl font-bold text-noir-gold mb-6 text-center">
          {selectedLetter}
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4 auto-rows-fr">
          {letterItems.map(item => (
            <li key={item.id}>
              <LinkCard data={item} type={type} />
            </li>
          ))}
        </ul>
        {letterItems.length === 0 && (
          <p className="text-center text-noir-gold/60 text-lg">
            No {type === "perfume" ? "perfumes" : "houses"} found starting with "
            {selectedLetter}"
          </p>
        )}
      </div>
    )
  }

  const groupedItems = groupByFirstLetter(items)
  const letters = Object.keys(groupedItems).sort()

  return (
    <div className={className}>
      {letters.map(letter => (
        <div key={letter} className="mb-12">
          <h2 className="text-2xl font-bold text-noir-gold mb-6 text-center">
            {letter}
          </h2>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4 auto-rows-fr">
            {groupedItems[letter].map(item => (
              <li key={item.id}>
                <LinkCard data={item} type={type} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {letters.length === 0 && (
        <p className="text-center text-noir-gold/60 text-lg">
          No {type === "perfume" ? "perfumes" : "houses"} found
        </p>
      )}
    </div>
  )
}

export default DataDisplay
