import Link from "next/link"

import type { OpenSplitChip } from "@/types/decant-split"

type ExchangeOpenSplitChipProps = {
  chips: OpenSplitChip[]
  label: string
}

export const ExchangeOpenSplitChip = ({
  chips,
  label,
}: ExchangeOpenSplitChipProps) => {
  if (chips.length === 0) return null

  const primary = chips[0]!

  return (
    <Link
      href={`/splits/${primary.splitId}`}
      className="inline-flex items-center rounded-full border border-noir-gold/60 bg-noir-gold/15 px-3 py-1 text-xs font-semibold text-noir-gold hover:bg-noir-gold/25"
      onClick={e => e.stopPropagation()}
    >
      {label}
    </Link>
  )
}
