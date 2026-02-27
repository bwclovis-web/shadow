/**
 * Diagnose Perfume Count Mismatch
 * 
 * This script helps identify why there's a mismatch between local and remote perfume counts.
 * It checks for:
 * - Perfumes that exist locally but not remotely
 * - Perfumes that exist remotely but not locally
 * - Perfumes with missing house references
 * - Perfumes with duplicate slugs
 * - Perfumes that failed to migrate due to constraints
 */

import { PrismaClient } from "@prisma/client"
import { Client } from "pg"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL
const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

if (!LOCAL_DATABASE_URL || !REMOTE_DATABASE_URL) {
  console.error("❌ Missing LOCAL_DATABASE_URL or REMOTE_DATABASE_URL in .env")
  process.exit(1)
}

const localClient = new Client({ connectionString: LOCAL_DATABASE_URL })
const remotePrisma = new PrismaClient({
  datasources: { db: { url: REMOTE_DATABASE_URL } },
})

const main = async () => {
  console.log("🔍 Diagnosing Perfume Count Mismatch...\n")
  
  await localClient.connect()
  
  try {
    // Get all local perfumes with their slugs
    console.log("📊 Fetching local perfumes...")
    const localPerfumesResult = await localClient.query(`
      SELECT id, name, slug, "perfumeHouseId", "createdAt", "updatedAt"
      FROM "Perfume"
      ORDER BY "createdAt" DESC
    `)
    const localPerfumes = localPerfumesResult.rows
    console.log(`   Found ${localPerfumes.length} local perfumes\n`)

    // Get all remote perfumes with their slugs (paginated to avoid 5MB limit)
    console.log("📊 Fetching remote perfumes (paginated)...")
    const remotePerfumes = []
    let skip = 0
    const pageSize = 1000
    
    while (true) {
      const page = await remotePrisma.perfume.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          perfumeHouseId: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      })
      
      if (page.length === 0) break
      
      remotePerfumes.push(...page)
      skip += pageSize
      
      if (page.length < pageSize) break
      
      process.stdout.write(`   Fetched ${remotePerfumes.length}...\r`)
    }
    
    console.log(`   Found ${remotePerfumes.length} remote perfumes\n`)

    // Create maps for quick lookup
    const localBySlug = new Map(localPerfumes.map(p => [p.slug, p]))
    const localById = new Map(localPerfumes.map(p => [p.id, p]))
    const remoteBySlug = new Map(remotePerfumes.map(p => [p.slug, p]))
    const remoteById = new Map(remotePerfumes.map(p => [p.id, p]))

    // Find perfumes that exist locally but not remotely
    console.log("🔍 Finding perfumes missing from remote...")
    const missingFromRemote = localPerfumes.filter(p => !remoteBySlug.has(p.slug))
    
    if (missingFromRemote.length > 0) {
      console.log(`   ⚠️  Found ${missingFromRemote.length} perfumes missing from remote:\n`)
      missingFromRemote.slice(0, 20).forEach(p => {
        console.log(`      - ${p.name} (slug: ${p.slug}, id: ${p.id})`)
        if (p.perfumeHouseId) {
          console.log(`        House ID: ${p.perfumeHouseId}`)
        }
      })
      if (missingFromRemote.length > 20) {
        console.log(`      ... and ${missingFromRemote.length - 20} more`)
      }
      console.log()
    } else {
      console.log("   ✅ All local perfumes exist in remote\n")
    }

    // Find perfumes that exist remotely but not locally
    console.log("🔍 Finding perfumes missing from local...")
    const missingFromLocal = remotePerfumes.filter(p => !localBySlug.has(p.slug))
    
    if (missingFromLocal.length > 0) {
      console.log(`   ⚠️  Found ${missingFromLocal.length} perfumes missing from local:\n`)
      missingFromLocal.slice(0, 20).forEach(p => {
        console.log(`      - ${p.name} (slug: ${p.slug}, id: ${p.id})`)
      })
      if (missingFromLocal.length > 20) {
        console.log(`      ... and ${missingFromLocal.length - 20} more`)
      }
      console.log()
    } else {
      console.log("   ✅ All remote perfumes exist in local\n")
    }

    // Check for duplicate slugs locally
    console.log("🔍 Checking for duplicate slugs locally...")
    const localSlugCounts = new Map()
    localPerfumes.forEach(p => {
      localSlugCounts.set(p.slug, (localSlugCounts.get(p.slug) || 0) + 1)
    })
    const localDuplicates = Array.from(localSlugCounts.entries())
      .filter(([slug, count]) => count > 1)
    
    if (localDuplicates.length > 0) {
      console.log(`   ⚠️  Found ${localDuplicates.length} duplicate slugs locally:\n`)
      localDuplicates.forEach(([slug, count]) => {
        const perfumes = localPerfumes.filter(p => p.slug === slug)
        console.log(`      - "${slug}" appears ${count} times:`)
        perfumes.forEach(p => {
          console.log(`        • ${p.name} (id: ${p.id})`)
        })
      })
      console.log()
    } else {
      console.log("   ✅ No duplicate slugs found locally\n")
    }

    // Check for perfumes with missing house references locally
    console.log("🔍 Checking for perfumes with missing house references locally...")
    const orphanedPerfumes = await localClient.query(`
      SELECT p.id, p.name, p.slug, p."perfumeHouseId"
      FROM "Perfume" p
      WHERE p."perfumeHouseId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "PerfumeHouse" h
        WHERE h.id = p."perfumeHouseId"
      )
    `)
    
    if (orphanedPerfumes.rows.length > 0) {
      console.log(`   ⚠️  Found ${orphanedPerfumes.rows.length} perfumes with missing house references:\n`)
      orphanedPerfumes.rows.slice(0, 20).forEach(p => {
        console.log(`      - ${p.name} (slug: ${p.slug}, houseId: ${p.perfumeHouseId})`)
      })
      if (orphanedPerfumes.rows.length > 20) {
        console.log(`      ... and ${orphanedPerfumes.rows.length - 20} more`)
      }
      console.log()
    } else {
      console.log("   ✅ All perfumes have valid house references\n")
    }

    // Check if missing perfumes have house references that exist remotely
    if (missingFromRemote.length > 0) {
      console.log("🔍 Checking if missing perfumes' houses exist remotely...")
      const missingHouseIds = new Set(
        missingFromRemote
          .map(p => p.perfumeHouseId)
          .filter(Boolean)
      )
      
      if (missingHouseIds.size > 0) {
        const remoteHouses = await remotePrisma.perfumeHouse.findMany({
          where: { id: { in: Array.from(missingHouseIds) } },
          select: { id: true },
        })
        const remoteHouseIds = new Set(remoteHouses.map(h => h.id))
        
        const missingHouses = Array.from(missingHouseIds).filter(
          id => !remoteHouseIds.has(id)
        )
        
        if (missingHouses.length > 0) {
          console.log(`   ⚠️  Found ${missingHouses.length} perfumes with houses missing from remote:\n`)
          const affectedPerfumes = missingFromRemote.filter(
            p => p.perfumeHouseId && missingHouses.includes(p.perfumeHouseId)
          )
          affectedPerfumes.slice(0, 10).forEach(p => {
            console.log(`      - ${p.name} (houseId: ${p.perfumeHouseId})`)
          })
          console.log()
        } else {
          console.log("   ✅ All houses exist remotely\n")
        }
      }
    }

    // Summary
    console.log("=".repeat(60))
    console.log("\n📋 Summary:\n")
    console.log(`   Local perfumes:  ${localPerfumes.length}`)
    console.log(`   Remote perfumes: ${remotePerfumes.length}`)
    console.log(`   Difference:      ${localPerfumes.length - remotePerfumes.length}`)
    console.log(`   Missing from remote: ${missingFromRemote.length}`)
    console.log(`   Missing from local:   ${missingFromLocal.length}`)
    
    if (missingFromRemote.length > 0) {
      console.log("\n💡 To fix missing perfumes:")
      console.log("   1. Ensure all perfume houses are migrated first")
      console.log("   2. Run: node scripts/migrate-to-accelerate-fixed.js --full")
      console.log("   3. Check for errors in the migration logs")
      console.log("   4. Re-run this script to verify")
    }
    
    console.log()
    
  } catch (error) {
    console.error("\n❌ Error:", error.message)
    console.error(error.stack)
  } finally {
    await localClient.end()
    await remotePrisma.$disconnect()
  }
}

main()
