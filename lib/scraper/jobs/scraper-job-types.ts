import type { PerfumeCsvRecord, ScrapedItem, ScraperConfig, ScraperRunResponse } from "@/types/scraper"

export const SCRAPER_JOB_STAGES = [
  "queued",
  "scraping",
  "normalizing",
  "note_extraction",
  "duplicate_analysis",
  "ready_for_review",
  "cancelled",
  "failed",
  "completed",
] as const

export type ScraperJobStage = (typeof SCRAPER_JOB_STAGES)[number]

export type ScraperJobProgress = {
  stage: ScraperJobStage
  percent: number
  message?: string
  productsTotal?: number
  productsDone?: number
  productsFailed?: number
  attempt?: number
  jobId?: string
  updatedAt?: string
}

export type ScraperJobResultSummary = {
  ok: boolean
  scrapedCount: number
  recordCount: number
  errors?: string[]
  batchWarnings?: string[]
  scraperLogTail?: string
}

export type ScraperJobConfigPayload = ScraperConfig

export const isScraperJobStage = (value: unknown): value is ScraperJobStage =>
  typeof value === "string" && (SCRAPER_JOB_STAGES as readonly string[]).includes(value)

export const parseProgressJson = (value: unknown): ScraperJobProgress | null => {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (!isScraperJobStage(v.stage)) return null
  const percent = typeof v.percent === "number" ? v.percent : 0
  return {
    stage: v.stage,
    percent,
    message: typeof v.message === "string" ? v.message : undefined,
    productsTotal: typeof v.productsTotal === "number" ? v.productsTotal : undefined,
    productsDone: typeof v.productsDone === "number" ? v.productsDone : undefined,
    productsFailed: typeof v.productsFailed === "number" ? v.productsFailed : undefined,
    attempt: typeof v.attempt === "number" ? v.attempt : undefined,
    jobId: typeof v.jobId === "string" ? v.jobId : undefined,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  }
}

export const buildProgress = (
  stage: ScraperJobStage,
  percent: number,
  extra?: Partial<Omit<ScraperJobProgress, "stage" | "percent">>
): ScraperJobProgress => ({
  stage,
  percent: Math.max(0, Math.min(100, Math.round(percent))),
  updatedAt: new Date().toISOString(),
  ...extra,
})

export const toScraperRunResponse = (params: {
  ok: boolean
  scrapedCount: number
  records: PerfumeCsvRecord[]
  csvContent: string
  errors: string[]
  scraperLog?: string
  batchWarnings?: string[]
  jobId: string
}): ScraperRunResponse => ({
  ok: params.ok,
  scrapedCount: params.scrapedCount,
  records: params.records,
  csvContent: params.csvContent,
  errors: params.errors,
  scraperLog: params.scraperLog,
  batchWarnings: params.batchWarnings,
  jobId: params.jobId,
})

export const parseScrapedItemsJson = (value: unknown): ScrapedItem[] => {
  if (!Array.isArray(value)) return []
  return value as ScrapedItem[]
}

export const parseRecordsJson = (value: unknown): PerfumeCsvRecord[] => {
  if (!Array.isArray(value)) return []
  return value as PerfumeCsvRecord[]
}
