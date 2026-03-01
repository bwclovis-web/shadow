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

import { getR2PublicUrl, uploadToR2 } from '@/lib/r2'

const PERFUME_PLACEHOLDER = '/images/single-bottle.webp'
const HOUSE_PLACEHOLDER = '/images/house-soon.webp'

const MAX_RETRIES = 2
const DELAY_MS = 100

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

function getExtensionFromUrl(url: string, contentType?: string | null): string {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i)
  if (match) return match[1].toLowerCase()
  if (contentType) {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
    }
    const ext = map[contentType.split(';')[0].trim().toLowerCase()]
    if (ext) return ext
  }
  return 'jpg'
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
 * - Otherwise: fetches, uploads to `perfumes/{perfumeId}.{ext}`, updates DB.
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
  const r2Base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? ''

  // Already on R2 — nothing to do
  if (r2Base && imageUrl.startsWith(r2Base)) {
    return { ok: true, skipped: true, newUrl: imageUrl }
  }

  const placeholder = type === 'house' ? HOUSE_PLACEHOLDER : PERFUME_PLACEHOLDER

  if (!isValidFetchUrl(imageUrl)) {
    if (dryRun) return { ok: true, skipped: true }
    await updateImage(prisma, type, id, placeholder)
    return { ok: true, newUrl: placeholder }
  }

  let buffer: ArrayBuffer
  let contentType: string | null = null

  try {
    const fetchResult = await withRetry(async () => {
      const res = await fetch(imageUrl.trim(), { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) {
        if (type === 'house' && res.status === 404) {
          return { response: null, usePlaceholder: true }
        }
        throw new Error(`HTTP ${res.status}`)
      }
      return { response: res, usePlaceholder: false }
    })

    if (fetchResult.usePlaceholder) {
      if (dryRun) return { ok: true, skipped: true }
      await updateImage(prisma, type, id, placeholder)
      return { ok: true, newUrl: placeholder }
    }

    const res = fetchResult.response!
    contentType = res.headers.get('content-type')
    buffer = await res.arrayBuffer()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isParseErr =
      msg.includes('Failed to parse URL') ||
      msg.includes('Invalid URL') ||
      msg.includes('fetch failed')
    if (isParseErr) {
      if (!dryRun) await updateImage(prisma, type, id, placeholder)
      return { ok: true, newUrl: placeholder }
    }
    return { ok: false, error: `fetch: ${msg}` }
  }

  const ext = getExtensionFromUrl(imageUrl, contentType)
  const key = type === 'house' ? `houses/${id}.${ext}` : `perfumes/${id}.${ext}`

  if (dryRun) return { ok: true, skipped: true }

  try {
    await withRetry(() => uploadToR2(key, Buffer.from(buffer), contentType ?? undefined))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `upload: ${msg}` }
  }

  const newUrl = getR2PublicUrl(key)

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
