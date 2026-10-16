"use client"

import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useJoinCta } from "@/components/Containers/SignupAvailability"
import {
  type JoinCtaPlacement,
  trackJoinCtaClick,
} from "@/utils/analytics/track-join-cta"
import { styleMerge } from "@/utils/styleUtils"

type JoinLinkProps = {
  placement?: JoinCtaPlacement
  className?: string
}

/** "New here? Join free" / "New here? Become a member" — for guest prompts. */
const JoinLink = ({ placement = "prompt", className }: JoinLinkProps) => {
  const t = useTranslations("join")
  const { href, newHereKey, freeOpen } = useJoinCta()

  return (
    <PrefetchLink
      href={href}
      onClick={() => trackJoinCtaClick(placement, freeOpen)}
      className={styleMerge(
        "text-sm text-noir-gold underline underline-offset-4 hover:text-noir-gold-500",
        className
      )}
    >
      {t(newHereKey)}
    </PrefetchLink>
  )
}

export default JoinLink
