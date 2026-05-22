"use client"

import { CountryFlagBadge } from "@/components/Molecules/CountryFlagBadge"
import type { TraderResponse } from "@/lib/queries/user"
import { resolveTraderCountry } from "@/utils/country-list"

import TraderSocialLinks from "./TraderSocialLinks"

type TraderProfileAboutExtrasProps = {
  trader: TraderResponse
}

/** Region and social links shown in the trader profile about block. */
const TraderProfileAboutExtras = ({ trader }: TraderProfileAboutExtrasProps) => {
  const country = resolveTraderCountry(trader.region)
  const hasSocial =
    Boolean(trader.instagramHandle?.trim()) ||
    Boolean(trader.fragranticaUrl?.trim()) ||
    Boolean(trader.redditUsername?.trim())

  if (!country && !hasSocial) {
    return null
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-noir-gold/20 pt-4">
      {country ? (
        <CountryFlagBadge code={country.code} label={country.name} size="md" />
      ) : null}
      <TraderSocialLinks
        instagramHandle={trader.instagramHandle}
        fragranticaUrl={trader.fragranticaUrl}
        redditUsername={trader.redditUsername}
        className="justify-start"
      />
    </div>
  )
}

export default TraderProfileAboutExtras
