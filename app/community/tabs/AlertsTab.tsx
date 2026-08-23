"use client"

import { useTranslations } from "next-intl"

import { SavedSearchesManager } from "@/components/Molecules/SavedSearchesManager/SavedSearchesManager"

type AlertsTabProps = {
  signedIn: boolean
  signInHref: string
}

export const AlertsTab = ({ signedIn, signInHref }: AlertsTabProps) => {
  const t = useTranslations("savedSearches")

  if (!signedIn) {
    return (
      <p className="text-sm text-noir-gold-100">
        <a href={signInHref} className="underline text-noir-gold">
          {t("signInCta")}
        </a>{" "}
        {t("signInSuffix")}
      </p>
    )
  }

  return <SavedSearchesManager />
}
