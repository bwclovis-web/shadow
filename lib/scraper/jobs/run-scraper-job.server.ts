import type { ChildProcess } from "node:child_process"

import { prisma } from "@/lib/db"
import { assessDuplicateRisk } from "@/lib/scraper/duplicate-review"
import {
  buildProgress,
  parseRecordsJson,
  parseScrapedItemsJson,
  toScraperRunResponse,
  type ScraperJobConfigPayload,
} from "@/lib/scraper/jobs/scraper-job-types"
import {
  dedupePreviewRecords,
  normalizeRecordNotes,
  recordsToCsv,
} from "@/lib/scraper/jobs/preview-normalize"
import {
  mapScrapedItemsToRecords,
  pythonMerchantNotesComplete,
  pythonPipelineComplete,
  scrapedItemsAreArtisticMilanoFragranzeHouse,
  scrapedItemsNeedArtisticFragrancesRepair,
  scrapedItemsNeedEtatLibreEnrichment,
  scrapedItemsNeedNodeRepair,
  scrapedItemsNeedNoteTranslation,
  scrapedItemsNeedPatternEtsyEnrichment,
} from "@/lib/scraper/map-scraped-items"
import { extractNotesForItems, type ScraperPipelineOptions } from "@/lib/scraper/notes-graph"
import { spawnScraperPythonProcess } from "@/lib/scraper/spawn-scraper-python"
import type {
  ScrapedItem,
  ScraperRunResponse,
  TitleDashSegment,
} from "@/types/scraper"
import { incrementCounter, recordTiming, withTiming } from "@/utils/server/metrics.server"
import {
  createWorkerId,
  getScraperJob,
  heartbeatScraperJob,
  updateScraperJob,
} from "@/models/scraper-job.server"

const SCRAPER_TIMEOUT_MS =
  typeof process.env.SCRAPER_TIMEOUT_MS === "string" &&
  /^\d+$/.test(process.env.SCRAPER_TIMEOUT_MS)
    ? Number(process.env.SCRAPER_TIMEOUT_MS)
    : 90 * 60 * 1000

const PROGRESS_STALL_MS = 4 * 60 * 1000
const HEARTBEAT_MS = 20_000

const resolveTitleDashSegment = (body: ScraperJobConfigPayload): TitleDashSegment => {
  if (
    body.titleDashSegment === "before" ||
    body.titleDashSegment === "after" ||
    body.titleDashSegment === "none"
  ) {
    return body.titleDashSegment
  }
  return "none"
}

const shouldSkipNodeNotesPipeline = (scrapedItems: ScrapedItem[]): boolean => {
  const hasPythonNotes = pythonPipelineComplete(scrapedItems)
  const hasCompleteMerchantNotes = pythonMerchantNotesComplete(scrapedItems)
  const needsNodeEnrichment = scrapedItemsNeedPatternEtsyEnrichment(scrapedItems)
  const needsNodeRepair = scrapedItemsNeedNodeRepair(scrapedItems)
  const needsEtatLibreEnrichment = scrapedItemsNeedEtatLibreEnrichment(scrapedItems)
  const needsArtisticFragrancesRepair = scrapedItemsNeedArtisticFragrancesRepair(scrapedItems)
  const needsNoteTranslation = scrapedItemsNeedNoteTranslation(scrapedItems)
  const allArtisticMilano = scrapedItemsAreArtisticMilanoFragranzeHouse(scrapedItems)
  return (
    !needsNoteTranslation &&
    ((allArtisticMilano && hasCompleteMerchantNotes) ||
      (hasPythonNotes && hasCompleteMerchantNotes && !needsArtisticFragrancesRepair) ||
      (hasPythonNotes &&
        !needsNodeEnrichment &&
        !needsNodeRepair &&
        !needsEtatLibreEnrichment &&
        !needsArtisticFragrancesRepair))
  )
}

const isCancelRequested = async (jobId: string): Promise<boolean> => {
  const job = await getScraperJob(jobId)
  return Boolean(job?.cancelRequested)
}

const killChild = (child: ChildProcess | null) => {
  if (!child || child.exitCode !== null) return
  try {
    child.kill()
  } catch {
    /* ignore */
  }
}

const runPythonScrape = async (params: {
  jobId: string
  workerId: string
  config: ScraperJobConfigPayload
  onLog?: (message: string) => void
}): Promise<{ scrapedItems: ScrapedItem[]; scraperLog: string }> => {
  const { jobId, workerId, config, onLog } = params
  const child = spawnScraperPythonProcess()
  let stdout = ""
  let scraperLog = ""
  let stderrBuffer = ""
  let lastProgressAt = Date.now()
  let stallKillIssued = false

  const heartbeatTimer = setInterval(() => {
    void heartbeatScraperJob(jobId, workerId)
  }, HEARTBEAT_MS)

  const stallTimer = setInterval(() => {
    if (stallKillIssued) return
    if (child.exitCode !== null) return
    if (Date.now() - lastProgressAt < PROGRESS_STALL_MS) return
    stallKillIssued = true
    onLog?.(
      `Scraper hung — no progress for ${Math.round((Date.now() - lastProgressAt) / 1000)}s. Stopping scrape.`
    )
    killChild(child)
  }, 30_000)

  const killTimer = setTimeout(() => killChild(child), SCRAPER_TIMEOUT_MS)

  const cancelPoll = setInterval(() => {
    void (async () => {
      if (await isCancelRequested(jobId)) {
        onLog?.("Cancel requested — stopping Python scraper.")
        killChild(child)
      }
    })()
  }, 5_000)

  try {
    const childStdin = child.stdin
    const childStdout = child.stdout
    const childStderr = child.stderr
    if (!childStdin || !childStdout || !childStderr) {
      throw new Error("Python subprocess did not expose stdin/stdout/stderr pipes.")
    }

    childStdout.on("data", (chunk: Buffer) => {
      lastProgressAt = Date.now()
      stdout += chunk.toString("utf8")
    })
    childStderr.on("data", (chunk: Buffer) => {
      lastProgressAt = Date.now()
      const text = chunk.toString("utf8")
      scraperLog += text
      stderrBuffer += text
      const lines = stderrBuffer.split("\n")
      stderrBuffer = lines.pop() ?? ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) onLog?.(trimmed)
      }
    })

    childStdin.write(
      JSON.stringify({
        houseName: config.houseName,
        collectionUrls: config.collectionUrls,
        productLinkSelector: config.productLinkSelector,
        nameSelector: config.nameSelector,
        descriptionSelector: config.descriptionSelector,
        notesSelector: (config.notesSelector ?? "").trim() || "",
        imageSelector: config.imageSelector,
        skipKeywords: config.skipKeywords,
        titleOmitWords: Array.isArray(config.titleOmitWords) ? config.titleOmitWords : [],
        baseUrl: config.baseUrl ?? "",
        etsyHeaded: config.etsyHeaded === true,
        headed: config.headed === true,
        skipSizeVariants: config.skipSizeVariants !== false,
        delayBetweenUrlsMs:
          typeof config.delayBetweenUrlsMs === "number" && config.delayBetweenUrlsMs >= 0
            ? config.delayBetweenUrlsMs
            : undefined,
        retryAttempts:
          typeof config.retryAttempts === "number" && config.retryAttempts >= 1
            ? config.retryAttempts
            : undefined,
        generateNoirDescriptions: config.generateNoirDescriptions ?? true,
        noteValidationMode: config.noteValidationMode === "off" ? "off" : "llm",
        notesPipelineModel: config.notesPipelineModel?.trim() || undefined,
        noirPipelineModel: config.noirPipelineModel?.trim() || undefined,
        discoveryMode: config.discoveryMode ?? "auto",
        maxProducts:
          typeof config.maxProducts === "number" && config.maxProducts > 0
            ? config.maxProducts
            : undefined,
        platformHint: config.platformHint?.trim() || undefined,
        externalNoteRescue: config.externalNoteRescue !== false,
        jobId,
        titleDashSegment: resolveTitleDashSegment(config),
        titleColonSegment:
          config.titleColonSegment === "before" ||
          config.titleColonSegment === "after" ||
          config.titleColonSegment === "none"
            ? config.titleColonSegment
            : "none",
        titleTakeAfterFirstComma: config.titleTakeAfterFirstComma === true,
        titleTakeBeforeFirstComma: config.titleTakeBeforeFirstComma === true,
        titleStripNumbers: config.titleStripNumbers ?? false,
      })
    )
    childStdin.end()

    const code: number | null = await new Promise((resolve, reject) => {
      child.on("error", reject)
      child.on("close", resolve)
    })

    if (stderrBuffer.trim()) onLog?.(stderrBuffer.trim())

    if (await isCancelRequested(jobId)) {
      throw new Error("CANCELLED")
    }

    if (code !== 0) {
      const tail = scraperLog.trim()
      const errorLine = tail.match(/(?:^|\n)Error: .+$/m)?.[0]
      const snippet = tail.length <= 1500 ? tail : `${tail.slice(-1500)}`
      throw new Error(
        errorLine
          ? `Scraper exited with code ${code}. ${errorLine}`
          : `Scraper exited with code ${code}. Stderr (last 1500 chars): ${snippet}`
      )
    }

    const parsed = JSON.parse(stdout) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error("Scraper output is not a JSON array")
    }
    return { scrapedItems: parsed as ScrapedItem[], scraperLog }
  } finally {
    clearInterval(heartbeatTimer)
    clearInterval(stallTimer)
    clearInterval(cancelPoll)
    clearTimeout(killTimer)
    try {
      child.stdin?.destroy()
      child.stdout?.destroy()
      child.stderr?.destroy()
    } catch {
      /* ignore */
    }
  }
}

/**
 * Execute a claimed scraper job through durable stages.
 * Preserves partial scraped items / records on cancel or failure.
 */
export const runScraperJob = async (
  jobId: string,
  options?: { workerId?: string; onLog?: (message: string) => void }
): Promise<ScraperRunResponse> => {
  const workerId = options?.workerId ?? createWorkerId()
  const onLog = options?.onLog
  const startedAt = Date.now()

  const job = await getScraperJob(jobId)
  if (!job) throw new Error("Job not found")
  if (job.status !== "running") {
    throw new Error(`Job ${jobId} is not running (status=${job.status})`)
  }

  const config = (job.configJson ?? null) as ScraperJobConfigPayload | null
  if (!config?.houseName || !Array.isArray(config.collectionUrls)) {
    throw new Error("Job is missing scraper configJson")
  }

  let scrapedItems = parseScrapedItemsJson(job.partialScrapedJson)
  let records = parseRecordsJson(job.partialRecordsJson)
  let scraperLog = ""

  try {
    const resume = job.resumeStage ?? "queued"

    if (resume === "queued" || resume === "scraping" || scrapedItems.length === 0) {
      await updateScraperJob(jobId, {
        progressJson: buildProgress("scraping", 10, {
          jobId,
          message: "Starting Python scrape",
        }),
        resumeStage: "scraping",
      })
      onLog?.("Starting Python scrape…")

      const scrape = await withTiming("scraper.job.scraping_ms", () =>
        runPythonScrape({ jobId, workerId, config, onLog })
      )
      scrapedItems = scrape.scrapedItems
      scraperLog = scrape.scraperLog

      await updateScraperJob(jobId, {
        partialScrapedJson: scrapedItems as unknown as object,
        progressJson: buildProgress("normalizing", 40, {
          jobId,
          productsTotal: scrapedItems.length,
          productsDone: scrapedItems.length,
          message: `Scraped ${scrapedItems.length} product(s)`,
        }),
        resumeStage: "normalizing",
      })
      incrementCounter("scraper.job.products_scraped", scrapedItems.length || 0)
    }

    if (await isCancelRequested(jobId)) throw new Error("CANCELLED")

    if (scrapedItems.length === 0) {
      const empty = toScraperRunResponse({
        ok: true,
        scrapedCount: 0,
        records: [],
        csvContent: "",
        errors: [
          "Scraper ran successfully but found 0 products. Check your collection URLs and selectors.",
        ],
        scraperLog: scraperLog.trim() || undefined,
        jobId,
      })
      await updateScraperJob(jobId, {
        status: "completed",
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        resumeStage: "ready_for_review",
        progressJson: buildProgress("ready_for_review", 100, {
          jobId,
          message: "0 products found",
        }),
        resultJson: {
          ok: true,
          scrapedCount: 0,
          recordCount: 0,
          errors: empty.errors,
          scraperLogTail: scraperLog.trim().slice(-4000) || undefined,
        },
        partialRecordsJson: [],
      })
      return empty
    }

    await updateScraperJob(jobId, {
      progressJson: buildProgress("note_extraction", 55, {
        jobId,
        productsTotal: scrapedItems.length,
        message: "Extracting / normalizing notes",
      }),
      resumeStage: "note_extraction",
    })

    if (await isCancelRequested(jobId)) throw new Error("CANCELLED")

    const skipNode = shouldSkipNodeNotesPipeline(scrapedItems)
    onLog?.(
      skipNode
        ? `Python notes complete — mapping ${scrapedItems.length} product(s).`
        : `Note extraction for ${scrapedItems.length} product(s)…`
    )

    const pipelineOptions: ScraperPipelineOptions = {
      enrichOnly: pythonPipelineComplete(scrapedItems),
      titleDashSegment: resolveTitleDashSegment(config),
      titleColonSegment:
        config.titleColonSegment === "before" ||
        config.titleColonSegment === "after" ||
        config.titleColonSegment === "none"
          ? config.titleColonSegment
          : "none",
      titleTakeAfterFirstComma: config.titleTakeAfterFirstComma === true,
      titleTakeBeforeFirstComma: config.titleTakeBeforeFirstComma === true,
      titleStripNumbers: config.titleStripNumbers ?? false,
      titleOmitWords: Array.isArray(config.titleOmitWords) ? config.titleOmitWords : [],
      generateNoirDescriptions: config.generateNoirDescriptions ?? true,
      fetchPdpNoteBootstrap: config.fetchPdpNoteBootstrap !== false,
      noteInferenceMode: config.noteInferenceMode === "strict" ? "strict" : "standard",
      minConfidentFlatNotes:
        typeof config.minConfidentFlatNotes === "number" &&
        config.minConfidentFlatNotes >= 1 &&
        config.minConfidentFlatNotes <= 50
          ? Math.floor(config.minConfidentFlatNotes)
          : undefined,
      notesPipelineModel: config.notesPipelineModel?.trim() || undefined,
      noirPipelineModel: config.noirPipelineModel?.trim() || undefined,
      noteValidationMode: config.noteValidationMode === "off" ? "off" : "llm",
      onProgress: message => onLog?.(message),
    }

    const { records: nodeRecords, batchWarnings } = await withTiming(
      "scraper.job.notes_ms",
      async () =>
        skipNode
          ? {
              records: mapScrapedItemsToRecords(scrapedItems, config.houseName),
              batchWarnings: [] as string[],
            }
          : extractNotesForItems(scrapedItems, config.houseName, pipelineOptions)
    )

    if (await isCancelRequested(jobId)) {
      await updateScraperJob(jobId, {
        partialRecordsJson: nodeRecords as unknown as object,
      })
      throw new Error("CANCELLED")
    }

    await updateScraperJob(jobId, {
      progressJson: buildProgress("duplicate_analysis", 85, {
        jobId,
        productsTotal: scrapedItems.length,
        productsDone: nodeRecords.length,
        message: "Deduping and duplicate-risk analysis",
      }),
      resumeStage: "duplicate_analysis",
      partialRecordsJson: nodeRecords as unknown as object,
    })

    const { records: dedupedRecords, warnings: dedupeWarnings } =
      dedupePreviewRecords(nodeRecords)
    let removedRepeatedNotes = 0
    const notesNormalizedRecords = dedupedRecords.map(r => {
      const normalized = normalizeRecordNotes(r)
      removedRepeatedNotes += normalized.removedCount
      return normalized.record
    })
    const noteWarnings =
      removedRepeatedNotes > 0
        ? [
            `Removed ${removedRepeatedNotes} repeated note entries across open/heart/base layers.`,
          ]
        : []

    records = await withTiming("scraper.job.duplicate_ms", () =>
      assessDuplicateRisk(notesNormalizedRecords, { prismaClient: prisma })
    )
    const combinedWarnings = [...batchWarnings, ...dedupeWarnings, ...noteWarnings]

    if (await isCancelRequested(jobId)) {
      await updateScraperJob(jobId, {
        partialRecordsJson: records as unknown as object,
      })
      throw new Error("CANCELLED")
    }

    const response = toScraperRunResponse({
      ok: true,
      scrapedCount: scrapedItems.length,
      records,
      csvContent: recordsToCsv(records),
      errors: [],
      scraperLog: scraperLog.trim() || undefined,
      batchWarnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
      jobId,
    })

    await updateScraperJob(jobId, {
      status: "completed",
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      resumeStage: "ready_for_review",
      partialRecordsJson: records as unknown as object,
      progressJson: buildProgress("ready_for_review", 100, {
        jobId,
        productsTotal: scrapedItems.length,
        productsDone: records.length,
        message: "Ready for review",
      }),
      resultJson: {
        ok: true,
        scrapedCount: scrapedItems.length,
        recordCount: records.length,
        batchWarnings: combinedWarnings,
      },
    })

    recordTiming("scraper.job.total_ms", Date.now() - startedAt, {
      house: config.houseName,
      scrapedCount: scrapedItems.length,
    })
    incrementCounter("scraper.job.completed")
    onLog?.(`Job complete — ${records.length} record(s) ready for review.`)
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "CANCELLED" || (await isCancelRequested(jobId))) {
      await updateScraperJob(jobId, {
        status: "cancelled",
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        errorMessage: "Cancelled",
        progressJson: buildProgress("cancelled", 100, {
          jobId,
          message: "Cancelled — partial results preserved",
        }),
        resultJson: {
          ok: false,
          scrapedCount: scrapedItems.length,
          recordCount: records.length,
          errors: ["Cancelled"],
        },
        partialScrapedJson:
          scrapedItems.length > 0 ? (scrapedItems as unknown as object) : undefined,
        partialRecordsJson:
          records.length > 0 ? (records as unknown as object) : undefined,
      })
      incrementCounter("scraper.job.cancelled")
      return toScraperRunResponse({
        ok: false,
        scrapedCount: scrapedItems.length,
        records,
        csvContent: recordsToCsv(records),
        errors: ["Cancelled"],
        scraperLog: scraperLog.trim() || undefined,
        jobId,
      })
    }

    await updateScraperJob(jobId, {
      status: "failed",
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      errorMessage: msg,
      progressJson: buildProgress("failed", 100, {
        jobId,
        message: msg,
      }),
      resultJson: {
        ok: false,
        scrapedCount: scrapedItems.length,
        recordCount: records.length,
        errors: [msg],
      },
      partialScrapedJson:
        scrapedItems.length > 0 ? (scrapedItems as unknown as object) : undefined,
      partialRecordsJson:
        records.length > 0 ? (records as unknown as object) : undefined,
    })
    incrementCounter("scraper.job.failed")
    throw err
  }
}
