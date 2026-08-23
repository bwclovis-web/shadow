/**
 * Single-record R2 image migration helper.
 *
 * Extracted from scripts/migrate-images-to-r2.ts so that the admin scraper
 * API route (and any future code) can migrate one perfume image at a time
 * without re-running the full batch script.
 *
 * The existing scripts/migrate-images-to-r2.ts can be updated to call this
 * helper directly, keeping the logic in one place.
 */

import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { getR2BaseUrl, getR2PublicUrl, uploadToR2 } from '@/lib/r2'

const PERFUME_PLACEHOLDER = '/images/single-bottle.webp'
const HOUSE_PLACEHOLDER = '/images/house-soon.webp'

const MAX_RETRIES = 2
const DELAY_MS = 100
const FETCH_TIMEOUT_MS = 30_000
const RETRYABLE_HTTP_STATUS = new Set([403, 408, 425, 429, 500, 502, 503, 504])
const FETCH_BACKOFF_MS = [900, 2_500, 6_000]

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < retries) await sleep(DELAY_MS)
    }
  }
  throw lastErr
}

function buildImageFetchHeaders(imageUrl: string): HeadersInit {
  let referer = "https://www.google.com/"
  try {
    const u = new URL(imageUrl)
    referer = `${u.protocol}//${u.host}/`
  } catch {
    // keep default
  }
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer,
    "Cache-Control": "no-cache",
  }
}

async function fetchImageWithBackoff(imageUrl: string, type: 'house' | 'perfume') {
  const { safeFetchUrl } = await import("@/utils/server/safe-fetch-url.server")
  const headers = buildImageFetchHeaders(imageUrl)
  let lastStatus: number | null = null

  for (let attempt = 0; attempt < FETCH_BACKOFF_MS.length; attempt++) {
    try {
      const { response } = await safeFetchUrl(imageUrl.trim(), {
        timeoutMs: FETCH_TIMEOUT_MS,
        maxBytes: 8 * 1024 * 1024,
        headers,
      })
      if (response.ok) return { response, usePlaceholder: false }
      if (type === 'house' && response.status === 404) return { response: null, usePlaceholder: true }

      lastStatus = response.status
      if (!RETRYABLE_HTTP_STATUS.has(response.status) || attempt === FETCH_BACKOFF_MS.length - 1) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      if (attempt === FETCH_BACKOFF_MS.length - 1) throw err
      const msg = err instanceof Error ? err.message : ""
      if (
        msg.includes("Private") ||
        msg.includes("Localhost") ||
        msg.includes("Internal") ||
        msg.includes("credentials") ||
        msg.includes("Invalid URL") ||
        msg.includes("http or https")
      ) {
        throw err
      }
    }
    await sleep(FETCH_BACKOFF_MS[attempt]!)
  }
  throw new Error(`HTTP ${lastStatus ?? "unknown"}`)
}

function isValidFetchUrl(url: string): boolean {
  if (!url?.trim()) return false
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Sync protocol check; full SSRF validation runs at fetch time via safeFetchUrl. */
async function assertSafeImageUrl(url: string): Promise<boolean> {
  if (!isValidFetchUrl(url)) return false
  const { validateSafeHttpUrl } = await import("@/utils/server/safe-fetch-url.server")
  const result = await validateSafeHttpUrl(url)
  return result.ok
}

export interface MigrateImageResult {
  ok: boolean
  /** New R2 URL or placeholder when ok=true; undefined on hard error */
  newUrl?: string
  error?: string
  skipped?: boolean
}

/**
 * Migrate a single perfume image to R2 and update the DB record.
 *
 * - If imageUrl already points to R2_PUBLIC_URL, returns ok=true (skipped).
 * - If imageUrl is invalid/404, sets the perfume image to the placeholder.
 * - Otherwise: fetches, converts to WebP, uploads to `perfumes/{perfumeId}.webp`, updates DB.
 *
 * @param perfumeId - Prisma Perfume.id
 * @param imageUrl  - Current image URL to migrate
 * @param options   - Optional: pass a shared PrismaClient; use dryRun to skip writes
 */
export async function migratePerfumeImageToR2(
  perfumeId: string,
  imageUrl: string,
  options?: { prismaClient?: PrismaClient; dryRun?: boolean },
): Promise<MigrateImageResult> {
  const ownClient = !options?.prismaClient
  const prisma = options?.prismaClient ?? new PrismaClient()
  const dryRun = options?.dryRun ?? false

  try {
    return await _migrateRecord(prisma, 'perfume', perfumeId, imageUrl, dryRun)
  } finally {
    if (ownClient) await prisma.$disconnect()
  }
}

/**
 * Migrate a single perfume house image to R2 and update the DB record.
 */
export async function migrateHouseImageToR2(
  houseId: string,
  imageUrl: string,
  options?: { prismaClient?: PrismaClient; dryRun?: boolean },
): Promise<MigrateImageResult> {
  const ownClient = !options?.prismaClient
  const prisma = options?.prismaClient ?? new PrismaClient()
  const dryRun = options?.dryRun ?? false

  try {
    return await _migrateRecord(prisma, 'house', houseId, imageUrl, dryRun)
  } finally {
    if (ownClient) await prisma.$disconnect()
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function _migrateRecord(
  prisma: PrismaClient,
  type: 'house' | 'perfume',
  id: string,
  imageUrl: string,
  dryRun: boolean,
): Promise<MigrateImageResult> {
  let r2Base: string
  try {
    r2Base = getR2BaseUrl()
  } catch {
    r2Base = ''
  }

  // Already on R2 — nothing to do (use same base as getR2PublicUrl so DB and skip check match)
  if (r2Base && imageUrl.startsWith(r2Base)) {
    return { ok: true, skipped: true, newUrl: imageUrl }
  }

  const placeholder = type === 'house' ? HOUSE_PLACEHOLDER : PERFUME_PLACEHOLDER

  if (!(await assertSafeImageUrl(imageUrl))) {
    if (dryRun) return { ok: true, skipped: true }
    await updateImage(prisma, type, id, placeholder)
    return { ok: true, newUrl: placeholder }
  }

  let buffer: ArrayBuffer

  try {
    const fetchResult = await withRetry(() => fetchImageWithBackoff(imageUrl, type))

    if (fetchResult.usePlaceholder) {
      if (dryRun) return { ok: true, skipped: true }
      await updateImage(prisma, type, id, placeholder)
      return { ok: true, newUrl: placeholder }
    }

    const res = fetchResult.response!
    buffer = await res.arrayBuffer()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isParseErr =
      msg.includes('Failed to parse URL') ||
      msg.includes('Invalid URL') ||
      msg.includes('fetch failed') ||
      msg.includes('Private') ||
      msg.includes('Localhost') ||
      msg.includes('not allowed')
    if (isParseErr) {
      if (!dryRun) await updateImage(prisma, type, id, placeholder)
      return { ok: true, newUrl: placeholder }
    }
    return { ok: false, error: `fetch: ${msg}` }
  }

  const key = type === 'house' ? `houses/${id}.webp` : `perfumes/${id}.webp`

  if (dryRun) return { ok: true, skipped: true }

  let storedKey: string
  try {
    storedKey = await withRetry(() => uploadToR2(key, Buffer.from(buffer)))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `upload: ${msg}` }
  }

  const newUrl = getR2PublicUrl(storedKey)

  try {
    await updateImage(prisma, type, id, newUrl)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `db update: ${msg}` }
  }

  return { ok: true, newUrl }
}

async function updateImage(
  prisma: PrismaClient,
  type: 'house' | 'perfume',
  id: string,
  image: string,
) {
  if (type === 'house') {
    await prisma.perfumeHouse.update({ where: { id }, data: { image } })
  } else {
    await prisma.perfume.update({ where: { id }, data: { image } })
  }
}
