/**
 * Migrate PerfumeHouse and Perfume images from external URLs to Cloudflare R2.
 * Downloads each image, uploads to R2, and updates DB with the new CDN URL.
 *
 * Usage:
 *   npm run migrate:images                    # Run migration
 *   npm run migrate:images -- --dry-run       # Log actions without DB updates
 *   npm run migrate:images -- --perfumes-only # Migrate perfumes only
 *
 * Safe to re-run: records already pointing at R2_PUBLIC_URL are skipped.
 * After a crash, run again to continue; progress is logged so you can see where it stopped.
 */

import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

import { getR2PublicUrl, uploadToR2 } from '../lib/r2'

const prisma = new PrismaClient()

const MAX_RETRIES = 2
const DELAY_MS = 100

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const getExtensionFromUrl = (url: string, contentType?: string | null): string => {
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

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> => {
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

const HOUSE_PLACEHOLDER = '/images/house-soon.webp'
const PERFUME_PLACEHOLDER = '/images/single-bottle.webp'

const isValidFetchUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string' || !url.trim()) return false
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const migrateRecord = async (
  type: 'house' | 'perfume',
  id: string,
  imageUrl: string,
  dryRun: boolean,
): Promise<{ ok: boolean; error?: string }> => {
  const r2Base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? ''
  if (r2Base && imageUrl.startsWith(r2Base)) {
    return { ok: true }
  }

  if (!isValidFetchUrl(imageUrl)) {
    const placeholder = type === 'house' ? HOUSE_PLACEHOLDER : PERFUME_PLACEHOLDER
    const model = type === 'house' ? 'house' : 'perfume'
    if (dryRun) {
      console.log(`[DRY-RUN] Would set ${model} ${id} to placeholder (invalid URL)`)
      return { ok: true }
    }
    if (type === 'house') {
      await prisma.perfumeHouse.update({
        where: { id },
        data: { image: placeholder },
      })
    } else {
      await prisma.perfume.update({
        where: { id },
        data: { image: placeholder },
      })
    }
    return { ok: true }
  }

  let buffer: ArrayBuffer
  let contentType: string | null = null

  try {
    const result = await withRetry(async () => {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) {
        if (type === 'house' && res.status === 404) {
          return { response: res, usePlaceholder: true }
        }
        throw new Error(`HTTP ${res.status}`)
      }
      return { response: res, usePlaceholder: false }
    })

    if (result.usePlaceholder) {
      if (dryRun) {
        console.log(`[DRY-RUN] Would set house ${id} to placeholder (404)`)
        return { ok: true }
      }
      await prisma.perfumeHouse.update({
        where: { id },
        data: { image: HOUSE_PLACEHOLDER },
      })
      return { ok: true }
    }

    const res = result.response
    contentType = res.headers.get('content-type')
    buffer = await res.arrayBuffer()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isUrlParseError =
      msg.includes('Failed to parse URL') ||
      msg.includes('Invalid URL') ||
      msg.includes('fetch failed')
    if (isUrlParseError) {
      const placeholder = type === 'house' ? HOUSE_PLACEHOLDER : PERFUME_PLACEHOLDER
      const model = type === 'house' ? 'house' : 'perfume'
      if (dryRun) {
        console.log(`[DRY-RUN] Would set ${model} ${id} to placeholder (${msg})`)
        return { ok: true }
      }
      if (type === 'house') {
        await prisma.perfumeHouse.update({
          where: { id },
          data: { image: placeholder },
        })
      } else {
        await prisma.perfume.update({
          where: { id },
          data: { image: placeholder },
        })
      }
      return { ok: true }
    }
    return { ok: false, error: `fetch: ${msg}` }
  }

  const ext = getExtensionFromUrl(imageUrl, contentType)
  const key = type === 'house' ? `houses/${id}.${ext}` : `perfumes/${id}.${ext}`

  if (dryRun) {
    console.log(`[DRY-RUN] Would upload ${type} ${id} -> ${key}`)
    return { ok: true }
  }

  try {
    await withRetry(() =>
      uploadToR2(key, Buffer.from(buffer), contentType ?? undefined),
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `upload: ${msg}` }
  }

  const newUrl = getR2PublicUrl(key)

  try {
    if (type === 'house') {
      await prisma.perfumeHouse.update({
        where: { id },
        data: { image: newUrl },
      })
    } else {
      await prisma.perfume.update({
        where: { id },
        data: { image: newUrl },
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `db update: ${msg}` }
  }

  return { ok: true }
}

const main = async () => {
  const dryRun = process.argv.includes('--dry-run')
  const perfumesOnly = process.argv.includes('--perfumes-only')
  const startedAt = new Date().toISOString()

  console.log(`Migration started at ${startedAt}`)
  if (dryRun) console.log('Running in DRY-RUN mode (no DB updates)')
  if (perfumesOnly) console.log('Processing perfumes only')
  console.log('')

  const houses = perfumesOnly
    ? []
    : await prisma.perfumeHouse.findMany({
        where: { image: { not: null } },
        select: { id: true, name: true, image: true },
      })

  const perfumes = await prisma.perfume.findMany({
    where: { image: { not: null } },
    select: { id: true, name: true, image: true },
  })

  const totalHouses = houses.length
  const totalPerfumes = perfumes.length
  console.log(`Total: ${totalHouses} houses, ${totalPerfumes} perfumes (already-on-R2 URLs will be skipped)\n`)

  let okHouses = 0
  let failHouses = 0
  let okPerfumes = 0
  let failPerfumes = 0

  for (let i = 0; i < houses.length; i++) {
    const h = houses[i]
    console.log(`[house ${i + 1}/${totalHouses}] ${h.name}`)
    const url = h.image!
    const result = await migrateRecord('house', h.id, url, dryRun)
    if (result.ok) {
      okHouses++
      if (!dryRun) console.log(`  ✓ done`)
    } else {
      failHouses++
      console.error(`  ✗ ${result.error}`)
    }
    await sleep(DELAY_MS)
  }

  for (let i = 0; i < perfumes.length; i++) {
    const p = perfumes[i]
    console.log(`[perfume ${i + 1}/${totalPerfumes}] ${p.name}`)
    const url = p.image!
    const result = await migrateRecord('perfume', p.id, url, dryRun)
    if (result.ok) {
      okPerfumes++
      if (!dryRun) console.log(`  ✓ done`)
    } else {
      failPerfumes++
      console.error(`  ✗ ${result.error}`)
    }
    await sleep(DELAY_MS)
  }

  console.log('\n--- Summary ---')
  console.log(`Houses:  ${okHouses} ok, ${failHouses} failed`)
  console.log(`Perfumes: ${okPerfumes} ok, ${failPerfumes} failed`)

  if (failHouses > 0 || failPerfumes > 0) {
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
