// Migration script to transfer data from local PostgreSQL to Prisma Accelerate
// Supports incremental migrations, batch processing, and dry-run mode
//
// Usage:
//   node scripts/migrate-to-accelerate-fixed.js [options]
//
// Options:
//   --dry-run        Show what would be migrated without actually doing it
//   --batch-size=N   Process records in batches of N (default: 100)
//   --full           Force full migration (ignore migration state)
//   --help           Show this help message

import { PrismaClient } from "@prisma/client"
import { Client } from "pg"
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env file
config({ path: resolve(process.cwd(), ".env") })

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const FULL_MIGRATION = args.includes("--full")
const SHOW_HELP = args.includes("--help") || args.includes("-h")
const BATCH_SIZE = (() => {
  const batchArg = args.find(arg => arg.startsWith("--batch-size="))
  if (batchArg) {
    const size = parseInt(batchArg.split("=")[1], 10)
    return isNaN(size) ? 100 : size
  }
  return 100
})()

if (SHOW_HELP) {
  console.log(`
Migration script to transfer data from local PostgreSQL to Prisma Accelerate

Usage:
  node scripts/migrate-to-accelerate-fixed.js [options]

Options:
  --dry-run        Show what would be migrated without actually doing it
  --batch-size=N   Process records in batches of N (default: 100)
  --full           Force full migration (ignore migration state)
  --help           Show this help message

Environment Variables (set in .env file):
  LOCAL_DATABASE_URL   Local PostgreSQL connection string
  REMOTE_DATABASE_URL  Prisma Accelerate connection string
`)
  process.exit(0)
}

// Validate environment variables
const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL
const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

if (!LOCAL_DATABASE_URL) {
  console.error("❌ ERROR: LOCAL_DATABASE_URL environment variable is not set")
  console.error("Please create a .env file with LOCAL_DATABASE_URL=postgresql://...")
  process.exit(1)
}

if (!REMOTE_DATABASE_URL) {
  console.error("❌ ERROR: REMOTE_DATABASE_URL environment variable is not set")
  console.error("Please create a .env file with REMOTE_DATABASE_URL=prisma+postgres://...")
  process.exit(1)
}

// Define the slug utility function inline
const createUrlSlug = name => {
  if (!name || typeof name !== "string") {
    return ""
  }

  return (
    name
      .replace(/%20/g, " ")
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-zA-Z0-9\-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
  )
}

// Local PostgreSQL connection using pg client
const localClient = new Client({
  connectionString: LOCAL_DATABASE_URL,
})

// Accelerate database connection using Prisma
const acceleratePrisma = new PrismaClient({
  datasources: {
    db: {
      url: REMOTE_DATABASE_URL,
    },
  },
})

// Track migrated records for reference (used for foreign key mapping)
const migratedHouses = new Map()
const migratedPerfumes = new Map()

// Migration statistics
const stats = {
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
}

// ============================================================================
// MIGRATION STATE MANAGEMENT
// ============================================================================

const ensureMigrationStateTable = async () => {
  console.log("🔧 Ensuring MigrationState table exists in remote database...")
  
  try {
    // Try to query the table - if it fails, the table doesn't exist
    await acceleratePrisma.migrationState.findFirst()
    console.log("✅ MigrationState table exists")
  } catch (error) {
    if (error.code === "P2021" || error.message.includes("does not exist")) {
      console.log("⚠️  MigrationState table not found on remote database.")
      console.log("")
      console.log("To fix this, push the schema to your remote database:")
      console.log("  1. Open your .env file")
      console.log("  2. Temporarily change DATABASE_URL to your REMOTE_DATABASE_URL value")
      console.log("  3. Run: npx prisma db push")
      console.log("  4. Change DATABASE_URL back to your local database URL")
      console.log("  5. Run this script again")
      console.log("")
      throw new Error("MigrationState table does not exist on remote. See instructions above.")
    }
    throw error
  }
}

const getLastMigrationTime = async tableName => {
  try {
    const state = await acceleratePrisma.migrationState.findUnique({
      where: { tableName },
    })
    return state?.lastMigratedAt || null
  } catch (error) {
    console.error(`Error getting migration state for ${tableName}:`, error.message)
    return null
  }
}

const updateMigrationState = async (tableName, timestamp, recordCount) => {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would update migration state for ${tableName}`)
    return
  }

  try {
    await acceleratePrisma.migrationState.upsert({
      where: { tableName },
      update: { 
        lastMigratedAt: timestamp,
        recordCount,
      },
      create: { 
        tableName, 
        lastMigratedAt: timestamp,
        recordCount,
      },
    })
  } catch (error) {
    console.error(`Error updating migration state for ${tableName}:`, error.message)
  }
}

// ============================================================================
// BATCH PROCESSING UTILITIES
// ============================================================================

const processBatch = async (records, processor, tableName) => {
  const total = records.length
  let processed = 0
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    
    for (const record of batch) {
      try {
        await processor(record)
        processed++
      } catch (error) {
        stats.errors++
        console.error(`  ❌ Error processing record:`, error.message)
      }
    }
    
    const progress = Math.min(i + BATCH_SIZE, total)
    console.log(`  📊 Progress: ${progress}/${total} records processed`)
  }
  
  return processed
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

const migrateUsers = async () => {
  console.log("\n🔄 Migrating users...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("User")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "User"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const users = result.rows
  console.log(`  Found ${users.length} users to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (users.length === 0) {
    console.log("  ✅ No new users to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${users.length} users`)
    users.slice(0, 5).forEach(u => console.log(`    - ${u.email}`))
    if (users.length > 5) console.log(`    ... and ${users.length - 5} more`)
    return
  }

  await processBatch(users, async user => {
    try {
      // Use email as the unique key, preserve local ID
      await acceleratePrisma.user.upsert({
        where: { email: user.email },
        update: {
          password: user.password,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: user.role,
          updatedAt: user.updatedAt,
        },
        create: {
          id: user.id,  // Preserve local ID
          email: user.email,
          password: user.password,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating user ${user.email}:`, error.message)
    }
  }, "User")

  await updateMigrationState("User", migrationStart, users.length)
  console.log("  ✅ Users migration completed")
}

const migratePerfumeHouses = async () => {
  console.log("\n🔄 Migrating perfume houses...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("PerfumeHouse")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "PerfumeHouse"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const houses = result.rows
  console.log(`  Found ${houses.length} perfume houses to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (houses.length === 0) {
    console.log("  ✅ No new perfume houses to migrate")
    // Still need to populate migratedHouses map for foreign key references
    const allHouses = await localClient.query('SELECT id FROM "PerfumeHouse"')
    allHouses.rows.forEach(h => migratedHouses.set(h.id, h.id))
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${houses.length} houses`)
    houses.slice(0, 5).forEach(h => console.log(`    - ${h.name}`))
    if (houses.length > 5) console.log(`    ... and ${houses.length - 5} more`)
    // Populate map for subsequent dry-run checks
    houses.forEach(h => migratedHouses.set(h.id, h.id))
    return
  }

  let processed = 0
  for (const house of houses) {
    try {
      const slug = createUrlSlug(house.name)

      // Use slug as the unique key, preserve local ID
      await acceleratePrisma.perfumeHouse.upsert({
        where: { slug: slug },
        update: {
          name: house.name,
          description: house.description,
          image: house.image,
          website: house.website,
          country: house.country,
          founded: house.founded,
          email: house.email,
          phone: house.phone,
          address: house.address,
          type: house.type,
          updatedAt: house.updatedAt,
        },
        create: {
          id: house.id,  // Preserve local ID
          name: house.name,
          slug: slug,
          description: house.description,
          image: house.image,
          website: house.website,
          country: house.country,
          founded: house.founded,
          email: house.email,
          phone: house.phone,
          address: house.address,
          type: house.type,
          createdAt: house.createdAt,
          updatedAt: house.updatedAt,
        },
      })

      migratedHouses.set(house.id, house.id)
      stats.created++
    } catch (error) {
      stats.errors++
      // Only log first few errors to avoid flooding console
      if (stats.errors <= 10) {
        console.error(`  ❌ Error migrating house ${house.name}:`, error.message?.substring(0, 100) || error)
      } else if (stats.errors === 11) {
        console.log(`  ⚠️  Suppressing further error messages...`)
      }
    }
    
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${houses.length} houses processed (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${houses.length} houses processed (${stats.errors} errors)`)

  // Populate map with all houses for foreign key references
  const allHouses = await localClient.query('SELECT id FROM "PerfumeHouse"')
  allHouses.rows.forEach(h => migratedHouses.set(h.id, h.id))

  await updateMigrationState("PerfumeHouse", migrationStart, houses.length)
  console.log("  ✅ Perfume houses migration completed")
}

const migratePerfumes = async () => {
  console.log("\n🔄 Migrating perfumes...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("Perfume")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "Perfume"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const perfumes = result.rows
  console.log(`  Found ${perfumes.length} perfumes to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (perfumes.length === 0) {
    console.log("  ✅ No new perfumes to migrate")
    // Populate map for foreign key references
    const allPerfumes = await localClient.query('SELECT id FROM "Perfume"')
    allPerfumes.rows.forEach(p => migratedPerfumes.set(p.id, p.id))
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${perfumes.length} perfumes`)
    perfumes.slice(0, 5).forEach(p => console.log(`    - ${p.name}`))
    if (perfumes.length > 5) console.log(`    ... and ${perfumes.length - 5} more`)
    perfumes.forEach(p => migratedPerfumes.set(p.id, p.id))
    return
  }

  // Track used slugs so duplicate names get unique slugs and every perfume gets its own row
  const usedSlugs = new Set()
  let duplicateSlugCount = 0

  for (const perfume of perfumes) {
    try {
      const baseSlug = createUrlSlug(perfume.name) || `perfume-${perfume.id}`
      const slug = usedSlugs.has(baseSlug) ? `${baseSlug}-${perfume.id}` : baseSlug
      if (usedSlugs.has(baseSlug)) duplicateSlugCount++
      usedSlugs.add(slug)

      const perfumeHouseId = perfume.perfumeHouseId && migratedHouses.has(perfume.perfumeHouseId)
        ? perfume.perfumeHouseId
        : null

      // Use slug as the unique key, preserve local ID (each perfume gets its own row)
      await acceleratePrisma.perfume.upsert({
        where: { slug: slug },
        update: {
          name: perfume.name,
          description: perfume.description,
          image: perfume.image,
          perfumeHouseId: perfumeHouseId,
          updatedAt: perfume.updatedAt,
        },
        create: {
          id: perfume.id,  // Preserve local ID
          name: perfume.name,
          slug: slug,
          description: perfume.description,
          image: perfume.image,
          perfumeHouseId: perfumeHouseId,
          createdAt: perfume.createdAt,
          updatedAt: perfume.updatedAt,
        },
      })

      migratedPerfumes.set(perfume.id, perfume.id)
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating perfume ${perfume.name}:`, error.message)
    }
  }

  if (duplicateSlugCount > 0) {
    console.log(`  ℹ️  ${duplicateSlugCount} perfumes had duplicate names and were given unique slugs (e.g. name-id)`)
  }

  // Populate map with all perfumes for foreign key references
  const allPerfumes = await localClient.query('SELECT id FROM "Perfume"')
  allPerfumes.rows.forEach(p => migratedPerfumes.set(p.id, p.id))

  await updateMigrationState("Perfume", migrationStart, perfumes.length)
  console.log("  ✅ Perfumes migration completed")
}

const migratePerfumeNotes = async () => {
  console.log("\n🔄 Migrating perfume notes...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("PerfumeNotes")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "PerfumeNotes"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const notes = result.rows
  console.log(`  Found ${notes.length} perfume notes to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (notes.length === 0) {
    console.log("  ✅ No new perfume notes to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${notes.length} notes`)
    notes.slice(0, 5).forEach(n => console.log(`    - ${n.name}`))
    if (notes.length > 5) console.log(`    ... and ${notes.length - 5} more`)
    return
  }

  for (const note of notes) {
    try {
      // Use name as the unique key, preserve local ID
      await acceleratePrisma.perfumeNotes.upsert({
        where: { name: note.name },
        update: {
          updatedAt: note.updatedAt,
        },
        create: {
          id: note.id,  // Preserve local ID
          name: note.name,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating note ${note.name}:`, error.message)
    }
  }

  await updateMigrationState("PerfumeNotes", migrationStart, notes.length)
  console.log("  ✅ Perfume notes migration completed")
}

const migratePerfumeNoteRelations = async () => {
  console.log("\n🔄 Migrating perfume note relations...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("PerfumeNoteRelation")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "PerfumeNoteRelation"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const relations = result.rows
  console.log(`  Found ${relations.length} note relations to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (relations.length === 0) {
    console.log("  ✅ No new note relations to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${relations.length} note relations`)
    return
  }

  // Only migrate relations where both perfume and note exist on remote (avoids FK violations
  // when perfumes were deduplicated by slug or some perfumes failed to migrate)
  const validRelations = relations.filter(
    r => migratedPerfumes.has(r.perfumeId)
  )
  const skipped = relations.length - validRelations.length
  if (skipped > 0) {
    console.log(`  ⚠️  Skipping ${skipped} relations whose perfume is not on remote (would cause FK errors)`)
  }

  for (const relation of validRelations) {
    try {
      await acceleratePrisma.perfumeNoteRelation.upsert({
        where: { id: relation.id },
        update: {
          perfumeId: relation.perfumeId,
          noteId: relation.noteId,
          noteType: relation.noteType,
          updatedAt: relation.updatedAt,
        },
        create: {
          id: relation.id,
          perfumeId: relation.perfumeId,
          noteId: relation.noteId,
          noteType: relation.noteType,
          createdAt: relation.createdAt,
          updatedAt: relation.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating note relation ${relation.id}:`, error.message)
    }
  }

  await updateMigrationState("PerfumeNoteRelation", migrationStart, relations.length)
  console.log("  ✅ Perfume note relations migration completed")
}

const migrateUserPerfumes = async () => {
  console.log("\n🔄 Migrating user perfumes...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("UserPerfume")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "UserPerfume"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const userPerfumes = result.rows
  console.log(`  Found ${userPerfumes.length} user perfumes to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (userPerfumes.length === 0) {
    console.log("  ✅ No new user perfumes to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${userPerfumes.length} user perfumes`)
    return
  }

  for (const userPerfume of userPerfumes) {
    try {
      await acceleratePrisma.userPerfume.upsert({
        where: { id: userPerfume.id },
        update: {
          userId: userPerfume.userId,
          perfumeId: userPerfume.perfumeId,
          amount: userPerfume.amount,
          available: userPerfume.available,
          price: userPerfume.price,
          placeOfPurchase: userPerfume.placeOfPurchase,
          tradePrice: userPerfume.tradePrice,
          tradePreference: userPerfume.tradePreference,
          tradeOnly: userPerfume.tradeOnly,
          type: userPerfume.type,
          updatedAt: userPerfume.updatedAt,
        },
        create: {
          id: userPerfume.id,
          userId: userPerfume.userId,
          perfumeId: userPerfume.perfumeId,
          amount: userPerfume.amount,
          available: userPerfume.available,
          price: userPerfume.price,
          placeOfPurchase: userPerfume.placeOfPurchase,
          tradePrice: userPerfume.tradePrice,
          tradePreference: userPerfume.tradePreference,
          tradeOnly: userPerfume.tradeOnly,
          type: userPerfume.type,
          createdAt: userPerfume.createdAt,
          updatedAt: userPerfume.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating user perfume ${userPerfume.id}:`, error.message)
    }
  }

  await updateMigrationState("UserPerfume", migrationStart, userPerfumes.length)
  console.log("  ✅ User perfumes migration completed")
}

const migrateUserPerfumeRatings = async () => {
  console.log("\n🔄 Migrating user perfume ratings...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("UserPerfumeRating")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "UserPerfumeRating"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const ratings = result.rows
  console.log(`  Found ${ratings.length} ratings to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (ratings.length === 0) {
    console.log("  ✅ No new ratings to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${ratings.length} ratings`)
    return
  }

  for (const rating of ratings) {
    try {
      await acceleratePrisma.userPerfumeRating.upsert({
        where: { id: rating.id },
        update: {
          userId: rating.userId,
          perfumeId: rating.perfumeId,
          gender: rating.gender,
          longevity: rating.longevity,
          overall: rating.overall,
          priceValue: rating.priceValue,
          sillage: rating.sillage,
          updatedAt: rating.updatedAt,
        },
        create: {
          id: rating.id,
          userId: rating.userId,
          perfumeId: rating.perfumeId,
          gender: rating.gender,
          longevity: rating.longevity,
          overall: rating.overall,
          priceValue: rating.priceValue,
          sillage: rating.sillage,
          createdAt: rating.createdAt,
          updatedAt: rating.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating rating ${rating.id}:`, error.message)
    }
  }

  await updateMigrationState("UserPerfumeRating", migrationStart, ratings.length)
  console.log("  ✅ User perfume ratings migration completed")
}

const migrateUserPerfumeReviews = async () => {
  console.log("\n🔄 Migrating user perfume reviews...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("UserPerfumeReview")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "UserPerfumeReview"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const reviews = result.rows
  console.log(`  Found ${reviews.length} reviews to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (reviews.length === 0) {
    console.log("  ✅ No new reviews to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${reviews.length} reviews`)
    return
  }

  for (const review of reviews) {
    try {
      await acceleratePrisma.userPerfumeReview.upsert({
        where: { id: review.id },
        update: {
          userId: review.userId,
          perfumeId: review.perfumeId,
          review: review.review,
          isApproved: review.isApproved,
          updatedAt: review.updatedAt,
        },
        create: {
          id: review.id,
          userId: review.userId,
          perfumeId: review.perfumeId,
          review: review.review,
          isApproved: review.isApproved,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating review ${review.id}:`, error.message)
    }
  }

  await updateMigrationState("UserPerfumeReview", migrationStart, reviews.length)
  console.log("  ✅ User perfume reviews migration completed")
}

const migrateUserPerfumeWishlists = async () => {
  console.log("\n🔄 Migrating user perfume wishlists...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("UserPerfumeWishlist")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "UserPerfumeWishlist"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const wishlists = result.rows
  console.log(`  Found ${wishlists.length} wishlists to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (wishlists.length === 0) {
    console.log("  ✅ No new wishlists to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${wishlists.length} wishlists`)
    return
  }

  for (const wishlist of wishlists) {
    try {
      await acceleratePrisma.userPerfumeWishlist.upsert({
        where: { id: wishlist.id },
        update: {
          userId: wishlist.userId,
          perfumeId: wishlist.perfumeId,
          isPublic: wishlist.isPublic,
          updatedAt: wishlist.updatedAt,
        },
        create: {
          id: wishlist.id,
          userId: wishlist.userId,
          perfumeId: wishlist.perfumeId,
          isPublic: wishlist.isPublic,
          createdAt: wishlist.createdAt,
          updatedAt: wishlist.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating wishlist ${wishlist.id}:`, error.message)
    }
  }

  await updateMigrationState("UserPerfumeWishlist", migrationStart, wishlists.length)
  console.log("  ✅ User perfume wishlists migration completed")
}

const migrateUserPerfumeComments = async () => {
  console.log("\n🔄 Migrating user perfume comments...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("UserPerfumeComment")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "UserPerfumeComment"'
  if (lastMigration) {
    query += ` WHERE "createdAt" > $1 OR "updatedAt" > $1 ORDER BY "createdAt" ASC`
  } else {
    query += ` ORDER BY "createdAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const comments = result.rows
  console.log(`  Found ${comments.length} comments to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (comments.length === 0) {
    console.log("  ✅ No new comments to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${comments.length} comments`)
    return
  }

  for (const comment of comments) {
    try {
      await acceleratePrisma.userPerfumeComment.upsert({
        where: { id: comment.id },
        update: {
          userId: comment.userId,
          perfumeId: comment.perfumeId,
          userPerfumeId: comment.userPerfumeId,
          comment: comment.comment,
          isPublic: comment.isPublic,
          updatedAt: comment.updatedAt,
        },
        create: {
          id: comment.id,
          userId: comment.userId,
          perfumeId: comment.perfumeId,
          userPerfumeId: comment.userPerfumeId,
          comment: comment.comment,
          isPublic: comment.isPublic,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating comment ${comment.id}:`, error.message)
    }
  }

  await updateMigrationState("UserPerfumeComment", migrationStart, comments.length)
  console.log("  ✅ User perfume comments migration completed")
}

const migrateWishlistNotifications = async () => {
  console.log("\n🔄 Migrating wishlist notifications...")

  const lastMigration = FULL_MIGRATION ? null : await getLastMigrationTime("WishlistNotification")
  const migrationStart = new Date()

  let query = 'SELECT * FROM "WishlistNotification"'
  if (lastMigration) {
    query += ` WHERE "notifiedAt" > $1 OR "updatedAt" > $1 ORDER BY "notifiedAt" ASC`
  } else {
    query += ` ORDER BY "notifiedAt" ASC`
  }

  const result = lastMigration
    ? await localClient.query(query, [lastMigration])
    : await localClient.query(query)
  
  const notifications = result.rows
  console.log(`  Found ${notifications.length} notifications to migrate${lastMigration ? " (incremental)" : " (full)"}`)

  if (notifications.length === 0) {
    console.log("  ✅ No new notifications to migrate")
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${notifications.length} notifications`)
    return
  }

  for (const notification of notifications) {
    try {
      await acceleratePrisma.wishlistNotification.upsert({
        where: { id: notification.id },
        update: {
          userId: notification.userId,
          perfumeId: notification.perfumeId,
          notifiedAt: notification.notifiedAt,
          updatedAt: notification.updatedAt,
        },
        create: {
          id: notification.id,
          userId: notification.userId,
          perfumeId: notification.perfumeId,
          notifiedAt: notification.notifiedAt,
          updatedAt: notification.updatedAt,
        },
      })
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating notification ${notification.id}:`, error.message)
    }
  }

  await updateMigrationState("WishlistNotification", migrationStart, notifications.length)
  console.log("  ✅ Wishlist notifications migration completed")
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

const main = async () => {
  console.log("🚀 Starting migration from local PostgreSQL to Prisma Accelerate...")
  console.log(`📊 Mode: ${DRY_RUN ? "DRY-RUN (no changes will be made)" : "LIVE"}`)
  console.log(`📊 Migration type: ${FULL_MIGRATION ? "FULL (ignoring migration state)" : "INCREMENTAL"}`)
  console.log(`📊 Batch size: ${BATCH_SIZE}`)
  console.log("")

  try {
    // Connect to local database
    await localClient.connect()
    console.log("✅ Connected to local PostgreSQL database")

    // Ensure migration state table exists
    await ensureMigrationStateTable()

    // Migrate in order to respect foreign key constraints
    await migrateUsers()
    await migratePerfumeHouses()
    await migratePerfumes()
    await migratePerfumeNotes()
    await migratePerfumeNoteRelations()
    await migrateUserPerfumes()
    await migrateUserPerfumeRatings()
    await migrateUserPerfumeReviews()
    await migrateUserPerfumeWishlists()
    await migrateUserPerfumeComments()
    await migrateWishlistNotifications()

    console.log("\n" + "=".repeat(60))
    if (DRY_RUN) {
      console.log("🔍 DRY-RUN COMPLETE - No changes were made")
    } else {
      console.log("🎉 Migration completed successfully!")
    }
    console.log(`📈 Statistics:`)
    console.log(`   - Records processed: ${stats.created}`)
    console.log(`   - Errors: ${stats.errors}`)
    console.log("=".repeat(60))
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  } finally {
    await localClient.end()
    await acceleratePrisma.$disconnect()
  }
}

main()
