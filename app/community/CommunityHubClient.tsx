"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"

import {
  AlertsTab,
  ChallengesTab,
  JournalTab,
  ShelvesTab,
  type CommunityTabId,
} from "./tabs"

interface CommunityHubClientProps {
  signedIn: boolean
  signInHref: string
}

const PANEL_FADE_MS = 280
const TAB_IDS: CommunityTabId[] = ["shelves", "journal", "challenges", "alerts"]

const CommunityHubClient = ({ signedIn, signInHref }: CommunityHubClientProps) => {
  const t = useTranslations("community")
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const perfumeParam = searchParams.get("perfumeId") ?? undefined
  const initialTab: CommunityTabId =
    tabParam && TAB_IDS.includes(tabParam as CommunityTabId)
      ? (tabParam as CommunityTabId)
      : "shelves"
  const [tab, setTab] = useState<CommunityTabId>(initialTab)
  const [visibleTab, setVisibleTab] = useState<CommunityTabId>(initialTab)
  const [panelVisible, setPanelVisible] = useState(true)
  const [mountedTabs, setMountedTabs] = useState<CommunityTabId[]>([initialTab])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (tabParam && TAB_IDS.includes(tabParam as CommunityTabId)) {
      setTab(tabParam as CommunityTabId)
    }
  }, [tabParam])

  const onMessage = useCallback((next: string | null) => {
    setMessage(next)
  }, [])

  const onError = useCallback((next: string | null) => {
    setError(next)
  }, [])

  const tabs: { id: CommunityTabId; label: string }[] = [
    { id: "shelves", label: t("tabs.shelves") },
    { id: "journal", label: t("tabs.journal") },
    { id: "challenges", label: t("tabs.challenges") },
    { id: "alerts", label: t("tabs.alerts") },
  ]

  useEffect(() => {
    setMountedTabs(prev => (prev.includes(tab) ? prev : [...prev, tab]))
  }, [tab])

  useEffect(() => {
    if (tab === visibleTab) {
      setPanelVisible(true)
      return
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleTab(tab)
      setPanelVisible(true)
      return
    }

    setPanelVisible(false)
    const timeoutId = window.setTimeout(() => {
      setVisibleTab(tab)
    }, PANEL_FADE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [tab, visibleTab])

  const showSignInPrompt =
    !signedIn && visibleTab !== "challenges" && visibleTab !== "alerts"

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-noir-gold/20 pb-3">
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id)
              setError(null)
              setMessage(null)
            }}
            className={`px-3 py-1.5 text-sm uppercase tracking-wide rounded border transition-[color,background-color,border-color] duration-300 ease-out motion-reduce:transition-none ${
              tab === item.id
                ? "border-noir-gold/60 text-noir-gold-500 bg-white/5"
                : "border-transparent text-noir-gold-500/70 hover:text-noir-gold-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-noir-gold-500" role="status">
          {message}
        </p>
      )}

      <div
        className={`transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
          panelVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {showSignInPrompt ? (
          <p className="text-sm text-noir-gold-500/80">
            {t("signInPrompt")}{" "}
            <PrefetchLink href={signInHref} className="underline text-noir-gold-500">
              {t("signIn")}
            </PrefetchLink>
          </p>
        ) : null}

        {mountedTabs.includes("shelves") && signedIn ? (
          <div hidden={visibleTab !== "shelves"}>
            <ShelvesTab onMessage={onMessage} onError={onError} />
          </div>
        ) : null}
        {mountedTabs.includes("journal") && signedIn ? (
          <div hidden={visibleTab !== "journal"}>
            <JournalTab
              onMessage={onMessage}
              onError={onError}
              initialPerfumeId={perfumeParam}
            />
          </div>
        ) : null}
        {mountedTabs.includes("challenges") ? (
          <div hidden={visibleTab !== "challenges"}>
            <ChallengesTab
              onError={onError}
              onMessage={onMessage}
              signedIn={signedIn}
            />
          </div>
        ) : null}
        {mountedTabs.includes("alerts") ? (
          <div hidden={visibleTab !== "alerts"}>
            <AlertsTab signedIn={signedIn} signInHref={signInHref} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CommunityHubClient
