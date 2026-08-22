"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"

import { useCSRF } from "@/hooks/useCSRF"
import type {
  DiscoveryMode,
  NoteInferenceMode,
  NoteValidationMode,
  PerfumeCsvRecord,
  ScraperImportResponse,
  ScraperRetryR2Response,
  ScraperRunRequest,
  ScraperRunResponse,
  ScraperSourcePreset,
  TitleDashSegment,
} from "@/types/scraper"
import {
  chunkPerfumeCsvRecordsForImport,
  chunkPerfumeCsvRecordsForRetryR2,
} from "@/utils/scraper-import-chunking"

import { SHOPIFY_DEFAULTS } from "./partials/constants"
import type { DetectedPlatform, ScraperDetectResult } from "@/lib/scraper/detect-platform"
import {
  buildPreviewRows,
  filterRecords,
  type PreviewFilter,
} from "./partials/preview"
import { ScrapeResultsPanel } from "./partials/ScrapeResultsPanel"
import { ScraperErrorPanel } from "./partials/ScraperErrorPanel"
import { ScraperFormActions } from "./partials/ScraperFormActions"
import { ScraperHouseSection } from "./partials/ScraperHouseSection"
import { ScraperRunningIndicator } from "./partials/ScraperRunningIndicator"
import { ScraperSavedResultsBanner } from "./partials/ScraperSavedResultsBanner"
import { ScraperSelectorsSection } from "./partials/ScraperSelectorsSection"
import { ScraperSkipRulesSection } from "./partials/ScraperSkipRulesSection"
import { ScraperTitleDescriptionSection } from "./partials/ScraperTitleDescriptionSection"
import {
  clearSavedScrapeResult,
  loadScrapeResultFromStorage,
  saveScrapeResultToStorage,
} from "./partials/storage"
import {
  countRecordsWithExtractedNotes,
  summarizeCollectionUrlsInput,
} from "./partials/url-utils"

export const ScraperPageClient = () => {
  const { addToHeaders, getTokenWithFallback } = useCSRF()

  const [houseName, setHouseName] = useState("")
  const [collectionUrlsRaw, setCollectionUrlsRaw] = useState("")
  const [sampleProductUrl, setSampleProductUrl] = useState("")
  const [productLinkSelector, setProductLinkSelector] = useState(
    SHOPIFY_DEFAULTS.productLinkSelector,
  )
  const [nameSelector, setNameSelector] = useState(SHOPIFY_DEFAULTS.nameSelector)
  const [descriptionSelector, setDescriptionSelector] = useState(
    SHOPIFY_DEFAULTS.descriptionSelector,
  )
  const [notesSelector, setNotesSelector] = useState("")
  const [imageSelector, setImageSelector] = useState(SHOPIFY_DEFAULTS.imageSelector)
  const [skipKeywordsRaw, setSkipKeywordsRaw] = useState(
    "set, sample, sampler, collection, collections, gift card, wax warmer, wax melt, oopsie",
  )
  const [baseUrl, setBaseUrl] = useState("")
  const [titleDashSegment, setTitleDashSegment] = useState<TitleDashSegment>("before")
  const [titleColonSegment, setTitleColonSegment] = useState<TitleDashSegment>("none")
  const [titleTakeAfterFirstComma, setTitleTakeAfterFirstComma] = useState(false)
  const [titleTakeBeforeFirstComma, setTitleTakeBeforeFirstComma] = useState(false)
  const [titleStripNumbers, setTitleStripNumbers] = useState(true)
  const [titleOmitWordsRaw, setTitleOmitWordsRaw] = useState(
    "eau de toilette, eau de parfum, edt, edp, travel size",
  )
  const [generateNoirDescriptions, setGenerateNoirDescriptions] = useState(true)
  const [etsyHeaded, setEtsyHeaded] = useState(false)
  const [headed, setHeaded] = useState(false)
  const [skipSizeVariants, setSkipSizeVariants] = useState(true)
  const [delayBetweenUrlsMs, setDelayBetweenUrlsMs] = useState<string>("")
  const [retryAttempts, setRetryAttempts] = useState<string>("")
  const [noteInferenceMode, setNoteInferenceMode] = useState<NoteInferenceMode>("standard")
  const [minConfidentFlatNotes, setMinConfidentFlatNotes] = useState("")
  const [notesPipelineModel, setNotesPipelineModel] = useState("")
  const [noirPipelineModel, setNoirPipelineModel] = useState("")
  const [noteValidationMode, setNoteValidationMode] = useState<NoteValidationMode>("llm")
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("auto")
  const [maxProducts, setMaxProducts] = useState("")
  const [externalNoteRescue, setExternalNoteRescue] = useState(true)
  const [platformHint, setPlatformHint] = useState<DetectedPlatform | "">("")
  const [detectSucceeded, setDetectSucceeded] = useState(false)
  const [detectSummary, setDetectSummary] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  /** When Smart Detect finds a suggested name with no matching house in the DB. */
  const [createHouseHref, setCreateHouseHref] = useState<string | null>(null)
  const [createHouseLabel, setCreateHouseLabel] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [savedSources, setSavedSources] = useState<ScraperSourcePreset[]>([])
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("all")
  const [allowHighDuplicateRisk, setAllowHighDuplicateRisk] = useState(false)

  const [scraping, setScraping] = useState(false)
  const [scrapeElapsedSeconds, setScrapeElapsedSeconds] = useState(0)
  const [scrapeProgressLog, setScrapeProgressLog] = useState<string[]>([])
  const [scrapeResult, setScrapeResult] = useState<ScraperRunResponse | null>(null)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [connectionCheck, setConnectionCheck] = useState<null | "checking" | "ok" | string>(null)
  const [savedScrapeResult, setSavedScrapeResult] = useState<ScraperRunResponse | null>(null)

  const scrapeAbortRef = useRef<AbortController | null>(null)
  const scrapeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userCancelledScrapeRef = useRef(false)

  useEffect(() => {
    const saved = loadScrapeResultFromStorage()
    if (saved) setSavedScrapeResult(saved)
  }, [])

  useEffect(() => {
    const loadSources = async () => {
      try {
        const res = await fetch("/api/admin/scraper/sources", { credentials: "include" })
        if (!res.ok) return
        const data = (await res.json()) as { sources?: ScraperSourcePreset[] }
        if (data.sources) setSavedSources(data.sources)
      } catch {
        // ignore
      }
    }
    void loadSources()
  }, [])

  useEffect(() => {
    if (!scraping) {
      setScrapeElapsedSeconds(0)
      return
    }
    const start = Date.now()
    const interval = setInterval(() => {
      setScrapeElapsedSeconds(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [scraping])

  useEffect(() => {
    if (!scraping) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor || anchor.target === "_blank" || !anchor.href) return
      try {
        const url = new URL(anchor.href)
        if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
          const leave = window.confirm(
            "Scraper is still running. If you leave this page you will lose the results. Leave anyway?",
          )
          if (!leave) {
            e.preventDefault()
            e.stopPropagation()
          }
        }
      } catch {
        // ignore invalid URLs
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleClick, true)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleClick, true)
    }
  }, [scraping])

  const collectionUrlsHint = useMemo(
    () => summarizeCollectionUrlsInput(collectionUrlsRaw),
    [collectionUrlsRaw],
  )

  const allRecords: PerfumeCsvRecord[] = useMemo(
    () => scrapeResult?.records ?? [],
    [scrapeResult?.records],
  )

  const records: PerfumeCsvRecord[] = useMemo(
    () => filterRecords(allRecords, previewFilter),
    [allRecords, previewFilter],
  )

  const notesExtractedCount = useMemo(
    () => countRecordsWithExtractedNotes(allRecords),
    [allRecords],
  )

  const previewRows = useMemo(() => buildPreviewRows(records), [records])

  const [uploadImagesToR2, setUploadImagesToR2] = useState(true)
  const [overwriteImageUrls, setOverwriteImageUrls] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ScraperImportResponse | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importConfirmed, setImportConfirmed] = useState(false)
  const [retryingR2, setRetryingR2] = useState(false)
  const [retryR2Result, setRetryR2Result] = useState<ScraperRetryR2Response | null>(null)
  const [retryR2Error, setRetryR2Error] = useState<string | null>(null)

  const buildScraperRunRequest = (): ScraperRunRequest => {
    const collectionUrls = collectionUrlsRaw
      .split(/\n|,/)
      .map(u => u.trim())
      .filter(Boolean)
      .filter(u => /^https?:\/\//i.test(u))

    const skipKeywords = skipKeywordsRaw
      .split(",")
      .map(k => k.trim())
      .filter(Boolean)

    const titleOmitWords = titleOmitWordsRaw
      .split(",")
      .map(w => w.trim())
      .filter(Boolean)

    return {
      houseName,
      collectionUrls,
      sampleProductUrl: sampleProductUrl || undefined,
      productLinkSelector,
      nameSelector,
      descriptionSelector,
      notesSelector: notesSelector.trim() || undefined,
      imageSelector,
      skipKeywords,
      baseUrl: baseUrl || undefined,
      titleDashSegment,
      titleColonSegment,
      titleTakeAfterFirstComma,
      titleTakeBeforeFirstComma,
      titleStripNumbers,
      titleOmitWords: titleOmitWords.length > 0 ? titleOmitWords : undefined,
      generateNoirDescriptions,
      skipSizeVariants,
      etsyHeaded: etsyHeaded || undefined,
      headed: headed || undefined,
      delayBetweenUrlsMs: (() => {
        const n = parseInt(delayBetweenUrlsMs, 10)
        return Number.isFinite(n) && n >= 0 ? n : undefined
      })(),
      retryAttempts: (() => {
        const n = parseInt(retryAttempts, 10)
        return Number.isFinite(n) && n >= 1 ? n : undefined
      })(),
      noteInferenceMode,
      minConfidentFlatNotes: (() => {
        const n = parseInt(minConfidentFlatNotes, 10)
        return Number.isFinite(n) && n >= 1 && n <= 50 ? n : undefined
      })(),
      notesPipelineModel: notesPipelineModel.trim() || undefined,
      noirPipelineModel: noirPipelineModel.trim() || undefined,
      noteValidationMode,
      discoveryMode,
      maxProducts: (() => {
        const n = parseInt(maxProducts, 10)
        return Number.isFinite(n) && n > 0 ? n : undefined
      })(),
      externalNoteRescue,
      platformHint: platformHint || undefined,
    }
  }

  const applyDetectResult = (
    result: ScraperDetectResult & {
      suggestedHouseName: string | null
      houseMatched?: boolean
    },
  ) => {
    setPlatformHint(result.platformHint)
    setDiscoveryMode(result.discoveryMode)
    setBaseUrl(result.baseUrl)
    setProductLinkSelector(result.selectors.productLinkSelector)
    setNameSelector(result.selectors.nameSelector)
    setDescriptionSelector(result.selectors.descriptionSelector)
    setImageSelector(result.selectors.imageSelector)
    if (result.notesSelector) setNotesSelector(result.notesSelector)
    else if (result.platformHint === "wix" || result.platformHint === "shopify") setNotesSelector("")
    if (result.needsHeaded) setHeaded(true)
    if (result.needsEtsyHeaded) setEtsyHeaded(true)
    if (result.suggestedHouseName && !houseName.trim()) {
      setHouseName(result.suggestedHouseName)
    }
    const houseMatched = result.houseMatched === true
    if (!houseMatched && result.suggestedHouseName?.trim()) {
      const params = new URLSearchParams({ name: result.suggestedHouseName.trim() })
      if (result.baseUrl?.trim()) params.set("website", result.baseUrl.trim())
      setCreateHouseHref(`/admin/create-house?${params.toString()}`)
      setCreateHouseLabel(result.suggestedHouseName.trim())
    } else {
      setCreateHouseHref(null)
      setCreateHouseLabel(null)
    }
    setDetectSucceeded(true)
    const parts = [
      `Platform: ${result.platform}`,
      result.needsHeaded ? "visible browser recommended" : null,
      result.captchaDetected ? "captcha detected" : null,
      houseMatched
        ? `house matched: ${result.suggestedHouseName}`
        : result.suggestedHouseName
          ? `no existing house for “${result.suggestedHouseName}”`
          : null,
    ].filter(Boolean)
    setDetectSummary(parts.join(" · "))
    setDetectError(null)
  }

  const handleSmartDetect = async () => {
    const firstUrl = collectionUrlsRaw
      .split(/\n|,/)
      .map(u => u.trim())
      .find(u => /^https?:\/\//i.test(u))
    if (!firstUrl) {
      setDetectError("Add at least one collection URL starting with http:// or https://.")
      return
    }
    setDetecting(true)
    setDetectError(null)
    setCreateHouseHref(null)
    setCreateHouseLabel(null)
    try {
      const csrf = getTokenWithFallback()
      const res = await fetch("/api/admin/scraper/detect", {
        method: "POST",
        headers: addToHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          collectionUrl: firstUrl,
          sampleProductUrl: sampleProductUrl.trim() || undefined,
          ...(csrf ? { _csrf: csrf } : {}),
        }),
      })
      const data = (await res.json()) as
        | (ScraperDetectResult & {
            suggestedHouseName: string | null
            houseMatched?: boolean
          })
        | { ok: false; error: string }
      if (!res.ok || !data.ok) {
        setDetectError("error" in data ? data.error : "Detect failed")
        setDetectSucceeded(false)
        return
      }
      applyDetectResult(data)
      if (data.warnings.length > 0) {
        setDetectSummary(prev => `${prev ?? ""} · ${data.warnings[0]}`.replace(/^ · /, ""))
      }
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : String(err))
      setDetectSucceeded(false)
    } finally {
      setDetecting(false)
    }
  }

  const handleLoadPreset = (preset: ScraperSourcePreset) => {
    const c = preset.configJson
    setHouseName(c.houseName)
    setCollectionUrlsRaw(c.collectionUrls.join("\n"))
    setSampleProductUrl(c.sampleProductUrl ?? "")
    setProductLinkSelector(c.productLinkSelector)
    setNameSelector(c.nameSelector)
    setDescriptionSelector(c.descriptionSelector)
    setNotesSelector(c.notesSelector ?? "")
    setImageSelector(c.imageSelector)
    setSkipKeywordsRaw(c.skipKeywords.join(", "))
    setBaseUrl(c.baseUrl ?? "")
    if (c.discoveryMode) setDiscoveryMode(c.discoveryMode)
    if (c.titleDashSegment) setTitleDashSegment(c.titleDashSegment)
    if (c.titleColonSegment) setTitleColonSegment(c.titleColonSegment)
    if (typeof c.titleTakeBeforeFirstComma === "boolean") {
      setTitleTakeBeforeFirstComma(c.titleTakeBeforeFirstComma)
    }
    if (typeof c.titleTakeAfterFirstComma === "boolean") {
      setTitleTakeAfterFirstComma(c.titleTakeAfterFirstComma)
    }
    if (typeof c.titleStripNumbers === "boolean") setTitleStripNumbers(c.titleStripNumbers)
    if (c.titleOmitWords?.length) setTitleOmitWordsRaw(c.titleOmitWords.join(", "))
    if (typeof c.generateNoirDescriptions === "boolean") {
      setGenerateNoirDescriptions(c.generateNoirDescriptions)
    }
    if (typeof c.skipSizeVariants === "boolean") setSkipSizeVariants(c.skipSizeVariants)
    if (typeof c.headed === "boolean") setHeaded(c.headed)
    if (typeof c.etsyHeaded === "boolean") setEtsyHeaded(c.etsyHeaded)
    if (typeof c.delayBetweenUrlsMs === "number") setDelayBetweenUrlsMs(String(c.delayBetweenUrlsMs))
    if (typeof c.retryAttempts === "number") setRetryAttempts(String(c.retryAttempts))
    if (c.noteInferenceMode) setNoteInferenceMode(c.noteInferenceMode)
    if (typeof c.minConfidentFlatNotes === "number") {
      setMinConfidentFlatNotes(String(c.minConfidentFlatNotes))
    }
    if (c.notesPipelineModel) setNotesPipelineModel(c.notesPipelineModel)
    if (c.noirPipelineModel) setNoirPipelineModel(c.noirPipelineModel)
    if (c.noteValidationMode) setNoteValidationMode(c.noteValidationMode)
    if (typeof c.externalNoteRescue === "boolean") setExternalNoteRescue(c.externalNoteRescue)
    if (typeof c.maxProducts === "number") setMaxProducts(String(c.maxProducts))
    const hint = (c.platformHint ?? preset.platformType ?? "") as DetectedPlatform | ""
    if (hint === "shopify" || hint === "woocommerce" || hint === "etsy" || hint === "wix" || hint === "unknown") {
      setPlatformHint(hint)
      setDetectSucceeded(true)
      setDetectSummary(`Loaded preset · platform: ${hint}`)
    }
  }

  const handleScrape = async (e: FormEvent) => {
    e.preventDefault()
    if (!houseName.trim()) {
      setScrapeError("Please enter or select a house name.")
      return
    }

    setScraping(true)
    setScrapeResult(null)
    setScrapeError(null)
    setConnectionCheck(null)
    setImportResult(null)
    setImportError(null)
    setImportConfirmed(false)
    setRetryR2Result(null)
    setRetryR2Error(null)

    const body = buildScraperRunRequest()
    if (body.collectionUrls.length === 0) {
      setScrapeError(
        "Add at least one collection URL. Each line or comma-separated value must start with http:// or https://.",
      )
      setScraping(false)
      return
    }

    const SCRAPER_REQUEST_TIMEOUT_MS = 90 * 60 * 1000
    const ac = new AbortController()
    scrapeAbortRef.current = ac
    userCancelledScrapeRef.current = false
    scrapeTimeoutRef.current = setTimeout(() => ac.abort(), SCRAPER_REQUEST_TIMEOUT_MS)

    try {
      const csrf = getTokenWithFallback()
      const res = await fetch("/api/admin/scraper/run", {
        method: "POST",
        headers: addToHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...body,
          ...(csrf ? { _csrf: csrf } : {}),
        }),
        credentials: "include",
        signal: ac.signal,
      })
      if (scrapeTimeoutRef.current != null) {
        clearTimeout(scrapeTimeoutRef.current)
        scrapeTimeoutRef.current = null
      }

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as ScraperRunResponse
        setScrapeError(data?.errors?.join("\n") ?? `Server error ${res.status}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const obj = JSON.parse(trimmed) as {
              type: string
              message?: string
              data?: ScraperRunResponse
            }
            if (obj.type === "log" && typeof obj.message === "string") {
              setScrapeProgressLog(prev => [...prev, obj.message!])
            } else if (obj.type === "result" && obj.data) {
              const data = obj.data
              if (!data.ok) {
                setScrapeError(data.errors?.join("\n") ?? "Unknown error")
              } else {
                setScrapeResult(data)
                saveScrapeResultToStorage(data)
                setSavedScrapeResult(null)
              }
              return
            }
          } catch {
            // skip malformed lines
          }
        }
      }
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer.trim()) as { type: string; data?: ScraperRunResponse }
          if (obj.type === "result" && obj.data) {
            const data = obj.data
            if (!data.ok) setScrapeError(data.errors?.join("\n") ?? "Unknown error")
            else {
              setScrapeResult(data)
              saveScrapeResultToStorage(data)
              setSavedScrapeResult(null)
            }
          } else {
            setScrapeError("Stream ended without a result")
          }
        } catch {
          setScrapeError("Incomplete response from server")
        }
      } else {
        setScrapeError("Stream ended without a result")
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unknown error"
      const isAborted = err instanceof Error && err.name === "AbortError"
      const userCancelled = userCancelledScrapeRef.current
      userCancelledScrapeRef.current = false

      if (userCancelled && isAborted) {
        setScrapeError(
          "Scrape cancelled. Your form settings are unchanged. The dev server keeps running; the Python scraper and note-extraction step for this run were stopped.",
        )
      } else if (raw === "Failed to fetch" || isAborted) {
        setScrapeError(
          (isAborted ? "Request timed out (90 min).\n\n" : "Failed to fetch\n\n") +
            "This usually means the run took too long and the connection was closed (browser, proxy, or server timeout).\n\n" +
            "• Use 1–2 collection URLs first to confirm the scraper works.\n" +
            "• Then run in smaller batches so each run finishes in a few minutes.\n" +
            "• Keep this tab in the foreground and don’t close it until the run completes.",
        )
      } else {
        setScrapeError(raw)
      }
    } finally {
      if (scrapeTimeoutRef.current != null) {
        clearTimeout(scrapeTimeoutRef.current)
        scrapeTimeoutRef.current = null
      }
      scrapeAbortRef.current = null
      setScraping(false)
    }
  }

  const handleCancelScrape = () => {
    if (!scraping) return
    userCancelledScrapeRef.current = true
    if (scrapeTimeoutRef.current != null) {
      clearTimeout(scrapeTimeoutRef.current)
      scrapeTimeoutRef.current = null
    }
    scrapeAbortRef.current?.abort()
    setScrapeProgressLog(prev => [...prev, "— Cancelled by user —"])
  }

  const handleImport = async () => {
    if (!scrapeResult?.records?.length) return

    setImporting(true)
    setImportResult(null)
    setImportError(null)

    const batches = chunkPerfumeCsvRecordsForImport(
      allRecords,
      uploadImagesToR2,
      overwriteImageUrls,
    )

    try {
      let importedCount = 0
      let r2UploadCount = 0
      const errors: string[] = []
      const failedR2Names: string[] = []

      for (let i = 0; i < batches.length; i++) {
        const csrf = getTokenWithFallback()
        const res = await fetch("/api/admin/scraper/import", {
          method: "POST",
          headers: addToHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            records: batches[i],
            uploadImagesToR2,
            overwriteImageUrls,
            allowHighDuplicateRisk,
            ...(csrf ? { _csrf: csrf } : {}),
          }),
          credentials: "include",
        })
        let data: ScraperImportResponse
        try {
          data = (await res.json()) as ScraperImportResponse
        } catch {
          setImportError(
            batches.length > 1
              ? `Import batch ${i + 1} of ${batches.length}: server returned an invalid response (status ${res.status}).`
              : `Server returned an invalid response (status ${res.status}).`,
          )
          return
        }

        if (!res.ok || !data.ok) {
          const prefix = batches.length > 1 ? `Batch ${i + 1} of ${batches.length}: ` : ""
          setImportError(prefix + (data.errors?.join("\n") ?? `Server error ${res.status}`))
          return
        }

        importedCount += data.importedCount
        r2UploadCount += data.r2UploadCount
        if (data.errors?.length) errors.push(...data.errors)
        if (data.failedR2Names?.length) failedR2Names.push(...data.failedR2Names)
      }

      setImportResult({
        ok: true,
        importedCount,
        r2UploadCount,
        errors,
        failedR2Names: failedR2Names.length > 0 ? failedR2Names : undefined,
      })
      setRetryR2Result(null)
      setRetryR2Error(null)
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unknown error"
      if (raw === "Failed to fetch") {
        setImportError(
          "Failed to fetch — the import request was dropped before the server responded.\n\n" +
            "Common causes: POST body too large for your host/proxy, or a network timeout. " +
            "This page splits large imports into multiple requests; if it still fails, run the scraper on fewer products per batch or import from a stable local dev session.",
        )
      } else {
        setImportError(raw)
      }
    } finally {
      setImporting(false)
      setImportConfirmed(false)
    }
  }

  const handleRetryR2Uploads = async () => {
    if (!scrapeResult?.records?.length) return

    setRetryingR2(true)
    setRetryR2Result(null)
    setRetryR2Error(null)

    const batches = chunkPerfumeCsvRecordsForRetryR2(scrapeResult.records)

    try {
      let attemptedCount = 0
      let uploadedCount = 0
      let skippedCount = 0
      const errors: string[] = []
      const failedR2Names: string[] = []

      for (let i = 0; i < batches.length; i++) {
        const csrf = getTokenWithFallback()
        const res = await fetch("/api/admin/scraper/retry-r2", {
          method: "POST",
          headers: addToHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            records: batches[i],
            ...(csrf ? { _csrf: csrf } : {}),
          }),
          credentials: "include",
        })
        let data: ScraperRetryR2Response
        try {
          data = (await res.json()) as ScraperRetryR2Response
        } catch {
          setRetryR2Error(
            batches.length > 1
              ? `R2 retry batch ${i + 1} of ${batches.length}: invalid response (status ${res.status}).`
              : `Invalid response (status ${res.status}).`,
          )
          return
        }
        if (!res.ok || !data.ok) {
          const prefix = batches.length > 1 ? `Batch ${i + 1} of ${batches.length}: ` : ""
          setRetryR2Error(prefix + (data.errors?.join("\n") ?? `Server error ${res.status}`))
          return
        }
        attemptedCount += data.attemptedCount
        uploadedCount += data.uploadedCount
        skippedCount += data.skippedCount
        if (data.errors?.length) errors.push(...data.errors)
        if (data.failedR2Names?.length) failedR2Names.push(...data.failedR2Names)
      }

      setRetryR2Result({
        ok: true,
        attemptedCount,
        uploadedCount,
        skippedCount,
        errors,
        failedR2Names: failedR2Names.length > 0 ? failedR2Names : undefined,
      })
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unknown error"
      if (raw === "Failed to fetch") {
        setRetryR2Error(
          "Failed to fetch — request was dropped (often payload size or network). Retry again; large result sets are sent in multiple batches automatically.",
        )
      } else {
        setRetryR2Error(raw)
      }
    } finally {
      setRetryingR2(false)
    }
  }

  const handleCheckConnection = async () => {
    setConnectionCheck("checking")
    try {
      const res = await fetch("/api/admin/scraper/health", { method: "GET" })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        setConnectionCheck("ok")
      } else {
        setConnectionCheck(res.ok ? "Unexpected response" : `Server returned ${res.status}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setConnectionCheck(msg)
    }
  }

  const handleDownloadCsv = () => {
    if (!scrapeResult?.csvContent) return
    const slug = houseName.toLowerCase().replace(/\s+/g, "-")
    const blob = new Blob([scrapeResult.csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `perfumes_${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSavePreset = async () => {
    const body = buildScraperRunRequest()
    const csrf = getTokenWithFallback()
    const res = await fetch("/api/admin/scraper/sources", {
      method: "POST",
      headers: addToHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify({
        config: body,
        platformType: platformHint || discoveryMode,
        ...(csrf ? { _csrf: csrf } : {}),
      }),
    })
    if (res.ok) {
      const data = (await res.json()) as { source?: ScraperSourcePreset }
      if (data.source) setSavedSources(prev => [data.source!, ...prev])
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">House Scraper</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure and run the scraper to collect products and extract notes. After reviewing the
          results you can confirm to import them into the database.
        </p>
      </div>

      <form onSubmit={handleScrape} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4 bg-noir-dark border-noir-gold text-noir-gold-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick start
          </h2>
          <p className="text-sm text-muted-foreground">
            Paste a collection URL, run Smart Detect to fill platform defaults, then Run. Open
            Advanced only when you need custom selectors or title rules.
          </p>
          {detectSummary && (
            <p className="rounded border border-noir-gold/40 bg-noir-gold/10 px-3 py-2 text-sm">
              {detectSucceeded ? "Detected — " : ""}
              {detectSummary}
            </p>
          )}
          {createHouseHref && createHouseLabel && (
            <p className="rounded border border-noir-gold/40 bg-noir-gold/10 px-3 py-2 text-sm">
              No matching house in the database.{" "}
              <a
                href={createHouseHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2 hover:text-noir-gold"
              >
                Create house “{createHouseLabel}”
              </a>{" "}
              (name and website prefilled).
            </p>
          )}
          {detectError && (
            <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {detectError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-noir-gold px-3 py-2 text-sm hover:bg-noir-gold/20 disabled:opacity-50"
              disabled={detecting || scraping}
              onClick={() => void handleSmartDetect()}
            >
              {detecting ? "Detecting…" : "Smart Detect"}
            </button>
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm hover:bg-muted/20"
              onClick={() => setShowAdvanced(v => !v)}
            >
              {showAdvanced ? "Hide advanced" : "Show advanced"}
            </button>
          </div>
        </section>

        <ScraperHouseSection
          houseName={houseName}
          setHouseName={setHouseName}
          discoveryMode={discoveryMode}
          setDiscoveryMode={setDiscoveryMode}
          maxProducts={maxProducts}
          setMaxProducts={setMaxProducts}
          savedSources={savedSources}
          onLoadPreset={handleLoadPreset}
          collectionUrlsRaw={collectionUrlsRaw}
          setCollectionUrlsRaw={setCollectionUrlsRaw}
          collectionUrlsHint={collectionUrlsHint}
          sampleProductUrl={sampleProductUrl}
          setSampleProductUrl={setSampleProductUrl}
          baseUrl={baseUrl}
          setBaseUrl={setBaseUrl}
          skipSizeVariants={skipSizeVariants}
          setSkipSizeVariants={setSkipSizeVariants}
          headed={headed}
          setHeaded={setHeaded}
          etsyHeaded={etsyHeaded}
          setEtsyHeaded={setEtsyHeaded}
          delayBetweenUrlsMs={delayBetweenUrlsMs}
          setDelayBetweenUrlsMs={setDelayBetweenUrlsMs}
          retryAttempts={retryAttempts}
          setRetryAttempts={setRetryAttempts}
          createHouseHref={createHouseHref}
          createHouseLabel={createHouseLabel}
          simpleMode={!showAdvanced}
        />

        {showAdvanced && (
          <>
            <ScraperSelectorsSection
              productLinkSelector={productLinkSelector}
              setProductLinkSelector={setProductLinkSelector}
              nameSelector={nameSelector}
              setNameSelector={setNameSelector}
              descriptionSelector={descriptionSelector}
              setDescriptionSelector={setDescriptionSelector}
              notesSelector={notesSelector}
              setNotesSelector={setNotesSelector}
              imageSelector={imageSelector}
              setImageSelector={setImageSelector}
            />

            <ScraperSkipRulesSection
              skipKeywordsRaw={skipKeywordsRaw}
              setSkipKeywordsRaw={setSkipKeywordsRaw}
            />

            <ScraperTitleDescriptionSection
              titleDashSegment={titleDashSegment}
              setTitleDashSegment={setTitleDashSegment}
              titleColonSegment={titleColonSegment}
              setTitleColonSegment={setTitleColonSegment}
              titleTakeBeforeFirstComma={titleTakeBeforeFirstComma}
              setTitleTakeBeforeFirstComma={setTitleTakeBeforeFirstComma}
              titleTakeAfterFirstComma={titleTakeAfterFirstComma}
              setTitleTakeAfterFirstComma={setTitleTakeAfterFirstComma}
              titleStripNumbers={titleStripNumbers}
              setTitleStripNumbers={setTitleStripNumbers}
              titleOmitWordsRaw={titleOmitWordsRaw}
              setTitleOmitWordsRaw={setTitleOmitWordsRaw}
              noteInferenceMode={noteInferenceMode}
              setNoteInferenceMode={setNoteInferenceMode}
              minConfidentFlatNotes={minConfidentFlatNotes}
              setMinConfidentFlatNotes={setMinConfidentFlatNotes}
              notesPipelineModel={notesPipelineModel}
              setNotesPipelineModel={setNotesPipelineModel}
              noirPipelineModel={noirPipelineModel}
              setNoirPipelineModel={setNoirPipelineModel}
              noteValidationMode={noteValidationMode}
              setNoteValidationMode={setNoteValidationMode}
              externalNoteRescue={externalNoteRescue}
              setExternalNoteRescue={setExternalNoteRescue}
              generateNoirDescriptions={generateNoirDescriptions}
              setGenerateNoirDescriptions={setGenerateNoirDescriptions}
            />
          </>
        )}

        <ScraperFormActions
          scraping={scraping}
          houseName={houseName}
          onSavePreset={handleSavePreset}
        />
      </form>

      {scraping && (
        <ScraperRunningIndicator
          scrapeElapsedSeconds={scrapeElapsedSeconds}
          scrapeProgressLog={scrapeProgressLog}
          onCancelScrape={handleCancelScrape}
        />
      )}

      {savedScrapeResult && !scrapeResult && !scraping && (
        <ScraperSavedResultsBanner
          savedScrapeResult={savedScrapeResult}
          onRestore={() => {
            setScrapeResult(savedScrapeResult)
            clearSavedScrapeResult()
            setSavedScrapeResult(null)
          }}
          onClear={() => {
            clearSavedScrapeResult()
            setSavedScrapeResult(null)
          }}
        />
      )}

      {scrapeError && (
        <ScraperErrorPanel
          scrapeError={scrapeError}
          connectionCheck={connectionCheck}
          onCheckConnection={handleCheckConnection}
        />
      )}

      {scrapeResult && (
        <ScrapeResultsPanel
          scrapeResult={scrapeResult}
          notesExtractedCount={notesExtractedCount}
          allRecords={allRecords}
          records={records}
          previewFilter={previewFilter}
          setPreviewFilter={setPreviewFilter}
          previewRows={previewRows}
          onDownloadCsv={handleDownloadCsv}
          importResult={importResult}
          importError={importError}
          overwriteImageUrls={overwriteImageUrls}
          setOverwriteImageUrls={setOverwriteImageUrls}
          uploadImagesToR2={uploadImagesToR2}
          setUploadImagesToR2={setUploadImagesToR2}
          allowHighDuplicateRisk={allowHighDuplicateRisk}
          setAllowHighDuplicateRisk={setAllowHighDuplicateRisk}
          importConfirmed={importConfirmed}
          setImportConfirmed={setImportConfirmed}
          importing={importing}
          onImport={handleImport}
          retryingR2={retryingR2}
          retryR2Error={retryR2Error}
          retryR2Result={retryR2Result}
          onRetryR2Uploads={handleRetryR2Uploads}
        />
      )}
    </div>
  )
}
