/**
 * One-off: Rewrite image URLs in DB from R2 API endpoint to R2 public URL.
 * Run after fixing R2_PUBLIC_URL in .env to your bucket's public URL (e.g. https://pub-xxx.r2.dev).
 *
 *   npx tsx scripts/rewrite-r2-urls-to-public.ts [--dry-run]
 */

import 'dotenv/config'
import { config } from 'dotenv'

// Load .env.local so R2_PUBLIC_URL matches Next.js
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const R2_API_HOST = 'https://2761fbf9d5ed34f02979efefc72bd1d3.r2.cloudflarestorage.com'

const prisma = new PrismaClient()

const main = async () => {
  const dryRun = process.argv.includes('--dry-run')
  const newBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')

  if (!newBase) {
    console.error('Set R2_PUBLIC_URL in .env to your bucket public URL (e.g. https://pub-xxx.r2.dev)')
    process.exit(1)
  }

  if (newBase === R2_API_HOST) {
    console.error('R2_PUBLIC_URL should be the public URL (e.g. https://pub-xxx.r2.dev), not the API endpoint.')
    process.exit(1)
  }

  console.log(`Replacing ${R2_API_HOST} with ${newBase}${dryRun ? ' (dry-run)' : ''}\n`)

  const houses = await prisma.perfumeHouse.findMany({
    where: { image: { not: null, startsWith: R2_API_HOST } },
    select: { id: true, name: true, image: true },
  })

  const perfumes = await prisma.perfume.findMany({
    where: { image: { not: null, startsWith: R2_API_HOST } },
    select: { id: true, name: true, image: true },
  })

  const newImage = (url: string) => url.replace(R2_API_HOST, newBase)

  for (const h of houses) {
    const updated = newImage(h.image!)
    console.log(`house ${h.name}: ${updated}`)
    if (!dryRun) {
      await prisma.perfumeHouse.update({
        where: { id: h.id },
        data: { image: updated },
      })
    }
  }

  for (const p of perfumes) {
    const updated = newImage(p.image!)
    console.log(`perfume ${p.name}: ${updated}`)
    if (!dryRun) {
      await prisma.perfume.update({
        where: { id: p.id },
        data: { image: updated },
      })
    }
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${houses.length} houses, ${perfumes.length} perfumes`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
