import type { ScraperRunResponse } from "@/types/scraper"

import { SCRAPER_SAVED_RESULT_KEY } from "./constants"

export const saveScrapeResultToStorage = (data: ScraperRunResponse) => {
  try {
    localStorage.setItem(SCRAPER_SAVED_RESULT_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded or private mode
  }
}

export const loadScrapeResultFromStorage = (): ScraperRunResponse | null => {
  try {
    const raw = localStorage.getItem(SCRAPER_SAVED_RESULT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== "object") return null
    const d = data as Record<string, unknown>
    if (d.ok !== true || !Array.isArray(d.records)) return null
    return data as ScraperRunResponse
  } catch {
    return null
  }
}

export const clearSavedScrapeResult = () => {
  try {
    localStorage.removeItem(SCRAPER_SAVED_RESULT_KEY)
  } catch {
    // ignore
  }
}
