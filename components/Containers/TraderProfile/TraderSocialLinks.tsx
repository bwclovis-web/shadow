"use client"

import { useTranslations } from "next-intl"
import { FaInstagram, FaReddit } from "react-icons/fa"
import { GiPerfumeBottle } from "react-icons/gi"

import {
  buildInstagramUrl,
  buildRedditUrl,
  normalizeInstagramHandle,
  normalizeRedditUsername,
} from "@/utils/trader-profile"

type TraderSocialLinksProps = {
  instagramHandle?: string | null
  fragranticaUrl?: string | null
  redditUsername?: string | null
  className?: string
}

const linkClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-noir-gold/40 text-noir-gold transition-colors hover:bg-noir-gold/20 hover:text-noir-gold-100"

const TraderSocialLinks = ({
  instagramHandle,
  fragranticaUrl,
  redditUsername,
  className = "",
}: TraderSocialLinksProps) => {
  const t = useTranslations("traderProfile.social")

  const instagram = normalizeInstagramHandle(instagramHandle)
  const reddit = normalizeRedditUsername(redditUsername)
  const fragrantica = fragranticaUrl?.trim() || null

  if (!instagram && !reddit && !fragrantica) {
    return null
  }

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {instagram ? (
        <a
          href={buildInstagramUrl(instagram)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-label={t("instagram", { handle: instagram })}
        >
          <FaInstagram size={18} aria-hidden />
        </a>
      ) : null}
      {reddit ? (
        <a
          href={buildRedditUrl(reddit)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-label={t("reddit", { username: reddit })}
        >
          <FaReddit size={18} aria-hidden />
        </a>
      ) : null}
      {fragrantica ? (
        <a
          href={fragrantica}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-label={t("fragrantica")}
        >
          <GiPerfumeBottle size={18} aria-hidden />
        </a>
      ) : null}
    </div>
  )
}

export default TraderSocialLinks
