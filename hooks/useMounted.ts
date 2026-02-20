"use client"

import { useEffect, useState } from "react"

/**
 * Returns true only after the component has mounted (client).
 * False during SSR and on the first client render, so server and initial
 * client HTML match and hydration succeeds. Use to defer i18n or other
 * client-only values that differ between server and client.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
