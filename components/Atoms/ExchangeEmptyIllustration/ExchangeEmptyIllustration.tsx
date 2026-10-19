import { LuImage } from "react-icons/lu"

import { styleMerge } from "@/utils/styleUtils"

/**
 * Temporary decorative empty-state slot (~240×160).
 * Future asset (do not request until shipped):
 * `public/images/new/exchange-empty.webp`
 *
 * Encapsulated so artwork can drop in later without rewriting empty copy.
 */
export type ExchangeEmptyIllustrationProps = {
  className?: string
}

export const ExchangeEmptyIllustration = ({
  className,
}: ExchangeEmptyIllustrationProps) => (
  <div
    aria-hidden
    className={styleMerge(
      "mx-auto flex h-40 w-60 items-center justify-center rounded-md border border-noir-gold/25 bg-noir-gray/90 text-noir-gold/50",
      className
    )}
  >
    <LuImage className="h-14 w-14" strokeWidth={1.25} />
  </div>
)
