"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { FaArrowRightArrowLeft } from "react-icons/fa6"

import type { MutualTradeSuggestion } from "@/models/mutual-trade-suggestions.server"

type MutualSwapsSectionProps = {
  suggestions: MutualTradeSuggestion[]
}

const MutualSwapsSection = ({ suggestions }: MutualSwapsSectionProps) => {
  const t = useTranslations("tradingPost.mutualSwaps")

  if (suggestions.length === 0) return null

  return (
    <section
      className="noir-border rounded-md border-noir-gold/30 bg-noir-dark/40 p-4"
      aria-labelledby="mutual-swaps-heading"
    >
      <div className="flex items-start gap-3">
        <FaArrowRightArrowLeft
          className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
          aria-hidden
        />
        <div>
          <h2
            id="mutual-swaps-heading"
            className="text-lg font-semibold text-noir-gold"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-noir-gold-100">{t("description")}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {suggestions.map(s => (
          <li
            key={`${s.traderId}-${s.youWant.listingId}-${s.theyWant.listingId}`}
            className="rounded border border-noir-gold/20 bg-black/20 px-3 py-3 text-sm text-noir-gold-100"
          >
            <p className="font-medium text-noir-gold">{s.traderDisplayName}</p>
            <p className="mt-1">
              {t("youWant")}{" "}
              <Link
                href={`/perfume/${s.youWant.perfumeSlug}`}
                className="text-noir-gold underline"
              >
                {s.youWant.perfumeName}
              </Link>
              {" · "}
              {t("theyWant")}{" "}
              <Link
                href={`/perfume/${s.theyWant.perfumeSlug}`}
                className="text-noir-gold underline"
              >
                {s.theyWant.perfumeName}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default MutualSwapsSection
