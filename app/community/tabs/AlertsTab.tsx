"use client"

import { SavedSearchesManager } from "@/components/Molecules/SavedSearchesManager/SavedSearchesManager"

type AlertsTabProps = {
  signedIn: boolean
  signInHref: string
}

export const AlertsTab = ({ signedIn, signInHref }: AlertsTabProps) => {
  if (!signedIn) {
    return (
      <p className="text-sm text-noir-gold-100">
        <a href={signInHref} className="underline text-noir-gold">
          Sign in
        </a>{" "}
        to manage Premium saved searches and alerts.
      </p>
    )
  }

  return <SavedSearchesManager />
}
