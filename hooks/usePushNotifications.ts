"use client"

import { useCallback, useEffect, useState } from "react"

import { useCSRF } from "@/hooks/useCSRF"
import {
  fetchVapidPublicKey,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  type PushSubscribeResult,
} from "@/utils/push-client"

export const usePushNotifications = () => {
  const { addToHeaders } = useCSRF()
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribing, setIsSubscribing] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const key = await fetchVapidPublicKey()
      setVapidPublicKey(key)
      setIsConfigured(Boolean(key))
      setIsLoading(false)
    }
    void load()
  }, [])

  const subscribe = useCallback(async (): Promise<PushSubscribeResult> => {
    if (!vapidPublicKey) {
      return { ok: false, reason: "no-vapid" }
    }
    setIsSubscribing(true)
    try {
      return await subscribeToWebPush(vapidPublicKey, addToHeaders())
    } finally {
      setIsSubscribing(false)
    }
  }, [vapidPublicKey, addToHeaders])

  const unsubscribe = useCallback(async () => {
    setIsSubscribing(true)
    try {
      await unsubscribeFromWebPush(addToHeaders())
    } finally {
      setIsSubscribing(false)
    }
  }, [addToHeaders])

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window

  return {
    isSupported,
    isConfigured,
    isLoading,
    isSubscribing,
    vapidPublicKey,
    subscribe,
    unsubscribe,
  }
}
