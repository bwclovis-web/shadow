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
//
// User, PerfumeHouse, Perfume, and PerfumeNotes upsert on primary key (id) so local IDs match
// remote; slug / name / email are written in update/create and stay consistent with local Postgres.

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
/** Local user id → remote user id (when email matches but primary keys differ) */
const migratedUsers = new Map()

const mapUserId = localId =>
  localId == null || localId === undefined ? null : migratedUsers.get(localId) ?? localId

/** Local PerfumeNotes id → remote id (name-unique merge / split-brain) */
const migratedNotes = new Map()

const mapNoteId = localId =>
  localId == null || localId === undefined ? null : migratedNotes.get(localId) ?? localId

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

/** Only advance incremental checkpoint when every row in this table succeeded; otherwise failed rows drop out of the next incremental query forever. */
const maybeUpdateMigrationState = async (tableName, timestamp, recordCount, errorsThisTable) => {
  if (errorsThisTable > 0) {
    console.log(
      `  ⚠️  ${tableName}: ${errorsThisTable} error(s); checkpoint not advanced — fix remote/local data or use --full, then re-run`,
    )
    return
  }
  await updateMigrationState(tableName, timestamp, recordCount)
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
    if (!DRY_RUN) {
      const allLocalUsers = await localClient.query('SELECT id, email FROM "User"')
      for (const u of allLocalUsers.rows) {
        if (migratedUsers.has(u.id)) continue
        const remote = await acceleratePrisma.user.findFirst({
          where: { OR: [{ id: u.id }, { email: u.email }] },
        })
        if (remote) migratedUsers.set(u.id, remote.id)
      }
    }
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${users.length} users`)
    users.slice(0, 5).forEach(u => console.log(`    - ${u.email}`))
    if (users.length > 5) console.log(`    ... and ${users.length - 5} more`)
    return
  }

  const errorsAtStart = stats.errors
  let processed = 0
  for (const user of users) {
    try {
      const dataForUpdate = {
        email: user.email,
        password: user.password,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        updatedAt: user.updatedAt,
      }

      const existingById = await acceleratePrisma.user.findUnique({
        where: { id: user.id },
      })
      if (existingById) {
        await acceleratePrisma.user.update({
          where: { id: user.id },
          data: dataForUpdate,
        })
        migratedUsers.set(user.id, user.id)
        stats.created++
      } else {
        const existingByEmail = await acceleratePrisma.user.findUnique({
          where: { email: user.email },
        })
        if (existingByEmail) {
          await acceleratePrisma.user.update({
            where: { id: existingByEmail.id },
            data: dataForUpdate,
          })
          migratedUsers.set(user.id, existingByEmail.id)
          stats.created++
        } else {
          await acceleratePrisma.user.create({
            data: {
              id: user.id,
              ...dataForUpdate,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          })
          migratedUsers.set(user.id, user.id)
          stats.created++
        }
      }
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating user ${user.email}:`, error.message)
    }
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${users.length} users processed`)
    }
  }
  console.log(`  📊 Progress: ${processed}/${users.length} records processed`)

  const allLocalUsers = await localClient.query('SELECT id, email FROM "User"')
  for (const u of allLocalUsers.rows) {
    if (migratedUsers.has(u.id)) continue
    const remote = await acceleratePrisma.user.findFirst({
      where: { OR: [{ id: u.id }, { email: u.email }] },
    })
    if (remote) migratedUsers.set(u.id, remote.id)
  }

  await maybeUpdateMigrationState("User", migrationStart, users.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0
  for (const house of houses) {
    try {
      const slug =
        (house.slug && String(house.slug).trim()) || createUrlSlug(house.name)

      const dataForUpdate = {
        name: house.name,
        slug,
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
      }

      const existingById = await acceleratePrisma.perfumeHouse.findUnique({
        where: { id: house.id },
      })
      const existingByName = await acceleratePrisma.perfumeHouse.findUnique({
        where: { name: house.name },
      })

      // Split-brain: one remote row matches local id (wrong name), another matches name (different id).
      // Updating the id row would violate unique(name). Prefer the name row as canonical; disambiguate the id row.
      if (existingById && existingByName && existingById.id !== existingByName.id) {
        await acceleratePrisma.perfumeHouse.update({
          where: { id: existingByName.id },
          data: dataForUpdate,
        })
        migratedHouses.set(house.id, existingByName.id)
        const suffix = existingById.id.slice(0, 8)
        const orphanName = `${house.name} (legacy ${suffix})`
        const orphanSlug = `${createUrlSlug(house.name)}-legacy-${suffix}`
        await acceleratePrisma.perfumeHouse.update({
          where: { id: existingById.id },
          data: {
            name: orphanName,
            slug: orphanSlug,
            updatedAt: new Date(),
          },
        })
        stats.created++
      } else if (existingById) {
        await acceleratePrisma.perfumeHouse.update({
          where: { id: house.id },
          data: dataForUpdate,
        })
        migratedHouses.set(house.id, house.id)
        stats.created++
      } else if (existingByName) {
        await acceleratePrisma.perfumeHouse.update({
          where: { id: existingByName.id },
          data: dataForUpdate,
        })
        migratedHouses.set(house.id, existingByName.id)
        stats.created++
      } else {
        await acceleratePrisma.perfumeHouse.create({
          data: {
            id: house.id,
            ...dataForUpdate,
            createdAt: house.createdAt,
            updatedAt: house.updatedAt,
          },
        })
        migratedHouses.set(house.id, house.id)
        stats.created++
      }
    } catch (error) {
      stats.errors++
      const p2002 =
        error.code === "P2002" && Array.isArray(error.meta?.target)
          ? ` [unique: ${error.meta.target.join(", ")}]`
          : ""
      // Only log first few errors to avoid flooding console
      if (stats.errors <= 10) {
        const msg = (error.message?.substring(0, 200) || String(error)) + p2002
        console.error(`  ❌ Error migrating house ${house.name}:`, msg)
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

  // Fill FK map for any local house not processed (e.g. error): resolve remote row by id or name — do not overwrite merged id mappings.
  const allHouses = await localClient.query('SELECT id, name FROM "PerfumeHouse"')
  for (const h of allHouses.rows) {
    if (migratedHouses.has(h.id)) continue
    const remote = await acceleratePrisma.perfumeHouse.findFirst({
      where: { OR: [{ id: h.id }, { name: h.name }] },
    })
    if (remote) migratedHouses.set(h.id, remote.id)
  }

  await maybeUpdateMigrationState("PerfumeHouse", migrationStart, houses.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0

  for (const perfume of perfumes) {
    try {
      const slug =
        (perfume.slug && String(perfume.slug).trim()) ||
        createUrlSlug(perfume.name) ||
        `perfume-${perfume.id}`

      const perfumeHouseId =
        perfume.perfumeHouseId && migratedHouses.has(perfume.perfumeHouseId)
          ? migratedHouses.get(perfume.perfumeHouseId)
          : null

      await acceleratePrisma.perfume.upsert({
        where: { id: perfume.id },
        update: {
          name: perfume.name,
          slug,
          description: perfume.description,
          image: perfume.image,
          perfumeHouseId: perfumeHouseId,
          updatedAt: perfume.updatedAt,
        },
        create: {
          id: perfume.id,
          name: perfume.name,
          slug,
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
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${perfumes.length} perfumes (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${perfumes.length} perfumes (${stats.errors} errors)`)

  // Populate map with all perfumes for foreign key references
  const allPerfumes = await localClient.query('SELECT id FROM "Perfume"')
  allPerfumes.rows.forEach(p => migratedPerfumes.set(p.id, p.id))

  await maybeUpdateMigrationState("Perfume", migrationStart, perfumes.length, stats.errors - errorsAtStart)
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
    if (!DRY_RUN) {
      const allLocal = await localClient.query('SELECT id, name FROM "PerfumeNotes"')
      for (const n of allLocal.rows) {
        if (migratedNotes.has(n.id)) continue
        const remote = await acceleratePrisma.perfumeNotes.findFirst({
          where: { OR: [{ id: n.id }, { name: n.name }] },
        })
        if (remote) migratedNotes.set(n.id, remote.id)
      }
    }
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would migrate ${notes.length} notes`)
    notes.slice(0, 5).forEach(n => console.log(`    - ${n.name}`))
    if (notes.length > 5) console.log(`    ... and ${notes.length - 5} more`)
    return
  }

  const errorsAtStart = stats.errors
  let processed = 0
  for (const note of notes) {
    try {
      const dataForUpdate = {
        name: note.name,
        updatedAt: note.updatedAt,
        perfumeOpenId: note.perfumeOpenId ?? note.perfumeopenid ?? null,
        perfumeHeartId: note.perfumeHeartId ?? note.perfumeheartid ?? null,
        perfumeCloseId: note.perfumeCloseId ?? note.perfumecloseid ?? null,
      }

      const existingById = await acceleratePrisma.perfumeNotes.findUnique({
        where: { id: note.id },
      })
      const existingByName = await acceleratePrisma.perfumeNotes.findUnique({
        where: { name: note.name },
      })

      if (existingById && existingByName && existingById.id !== existingByName.id) {
        await acceleratePrisma.perfumeNotes.update({
          where: { id: existingByName.id },
          data: dataForUpdate,
        })
        migratedNotes.set(note.id, existingByName.id)
        const suffix = existingById.id.slice(0, 8)
        const orphanName = `${note.name} (legacy ${suffix})`
        await acceleratePrisma.perfumeNotes.update({
          where: { id: existingById.id },
          data: {
            name: orphanName,
            updatedAt: new Date(),
          },
        })
        stats.created++
      } else if (existingById) {
        await acceleratePrisma.perfumeNotes.update({
          where: { id: note.id },
          data: dataForUpdate,
        })
        migratedNotes.set(note.id, note.id)
        stats.created++
      } else if (existingByName) {
        await acceleratePrisma.perfumeNotes.update({
          where: { id: existingByName.id },
          data: dataForUpdate,
        })
        migratedNotes.set(note.id, existingByName.id)
        stats.created++
      } else {
        await acceleratePrisma.perfumeNotes.create({
          data: {
            id: note.id,
            name: note.name,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            perfumeOpenId: dataForUpdate.perfumeOpenId,
            perfumeHeartId: dataForUpdate.perfumeHeartId,
            perfumeCloseId: dataForUpdate.perfumeCloseId,
          },
        })
        migratedNotes.set(note.id, note.id)
        stats.created++
      }
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating note ${note.name}:`, error.message)
    }
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${notes.length} notes (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${notes.length} notes (${stats.errors} errors)`)

  const allLocalNotes = await localClient.query('SELECT id, name FROM "PerfumeNotes"')
  for (const n of allLocalNotes.rows) {
    if (migratedNotes.has(n.id)) continue
    const remote = await acceleratePrisma.perfumeNotes.findFirst({
      where: { OR: [{ id: n.id }, { name: n.name }] },
    })
    if (remote) migratedNotes.set(n.id, remote.id)
  }

  await maybeUpdateMigrationState("PerfumeNotes", migrationStart, notes.length, stats.errors - errorsAtStart)
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

  // Require perfume and note on remote (note ids often diverge like houses — use migratedNotes)
  const validRelations = relations.filter(
    r => migratedPerfumes.has(r.perfumeId) && migratedNotes.has(r.noteId),
  )
  const skipped = relations.length - validRelations.length
  if (skipped > 0) {
    console.log(
      `  ⚠️  Skipping ${skipped} relations missing perfume or note on remote (would cause FK errors)`,
    )
  }

  const errorsAtStart = stats.errors
  let processed = 0
  for (const relation of validRelations) {
    try {
      const remoteNoteId = mapNoteId(relation.noteId)
      const perfumeId = relation.perfumeId
      const noteType = relation.noteType ?? relation.notetype
      const dataForRow = {
        perfumeId,
        noteId: remoteNoteId,
        noteType,
        updatedAt: relation.updatedAt,
      }

      const existingById = await acceleratePrisma.perfumeNoteRelation.findUnique({
        where: { id: relation.id },
      })

      if (existingById) {
        await acceleratePrisma.perfumeNoteRelation.update({
          where: { id: relation.id },
          data: dataForRow,
        })
      } else {
        const existingByTriple = await acceleratePrisma.perfumeNoteRelation.findFirst({
          where: { perfumeId, noteId: remoteNoteId, noteType },
        })
        if (existingByTriple) {
          // Same perfume+note+type already on remote under another id (after note-id remap).
          await acceleratePrisma.$transaction([
            acceleratePrisma.perfumeNoteRelation.delete({
              where: { id: existingByTriple.id },
            }),
            acceleratePrisma.perfumeNoteRelation.create({
              data: {
                id: relation.id,
                perfumeId,
                noteId: remoteNoteId,
                noteType,
                createdAt: relation.createdAt,
                updatedAt: relation.updatedAt,
              },
            }),
          ])
        } else {
          await acceleratePrisma.perfumeNoteRelation.create({
            data: {
              id: relation.id,
              perfumeId,
              noteId: remoteNoteId,
              noteType,
              createdAt: relation.createdAt,
              updatedAt: relation.updatedAt,
            },
          })
        }
      }
      stats.created++
    } catch (error) {
      stats.errors++
      console.error(`  ❌ Error migrating note relation ${relation.id}:`, error.message)
    }
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${validRelations.length} note relations (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${validRelations.length} note relations (${stats.errors} errors)`)

  await maybeUpdateMigrationState("PerfumeNoteRelation", migrationStart, relations.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0
  for (const userPerfume of userPerfumes) {
    try {
      await acceleratePrisma.userPerfume.upsert({
        where: { id: userPerfume.id },
        update: {
          userId: mapUserId(userPerfume.userId),
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
          userId: mapUserId(userPerfume.userId),
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
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${userPerfumes.length} user perfumes (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${userPerfumes.length} user perfumes (${stats.errors} errors)`)

  await maybeUpdateMigrationState("UserPerfume", migrationStart, userPerfumes.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0
  for (const rating of ratings) {
    try {
      await acceleratePrisma.userPerfumeRating.upsert({
        where: { id: rating.id },
        update: {
          userId: mapUserId(rating.userId),
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
          userId: mapUserId(rating.userId),
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
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${ratings.length} ratings (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${ratings.length} ratings (${stats.errors} errors)`)

  await maybeUpdateMigrationState("UserPerfumeRating", migrationStart, ratings.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0
  for (const review of reviews) {
    try {
      await acceleratePrisma.userPerfumeReview.upsert({
        where: { id: review.id },
        update: {
          userId: mapUserId(review.userId),
          perfumeId: review.perfumeId,
          review: review.review,
          isApproved: review.isApproved,
          updatedAt: review.updatedAt,
        },
        create: {
          id: review.id,
          userId: mapUserId(review.userId),
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
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${reviews.length} reviews (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${reviews.length} reviews (${stats.errors} errors)`)

  await maybeUpdateMigrationState("UserPerfumeReview", migrationStart, reviews.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0
  for (const wishlist of wishlists) {
    try {
      await acceleratePrisma.userPerfumeWishlist.upsert({
        where: { id: wishlist.id },
        update: {
          userId: mapUserId(wishlist.userId),
          perfumeId: wishlist.perfumeId,
          isPublic: wishlist.isPublic,
          updatedAt: wishlist.updatedAt,
        },
        create: {
          id: wishlist.id,
          userId: mapUserId(wishlist.userId),
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

  await maybeUpdateMigrationState("UserPerfumeWishlist", migrationStart, wishlists.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0
  for (const comment of comments) {
    try {
      await acceleratePrisma.userPerfumeComment.upsert({
        where: { id: comment.id },
        update: {
          userId: mapUserId(comment.userId),
          perfumeId: comment.perfumeId,
          userPerfumeId: comment.userPerfumeId,
          comment: comment.comment,
          isPublic: comment.isPublic,
          updatedAt: comment.updatedAt,
        },
        create: {
          id: comment.id,
          userId: mapUserId(comment.userId),
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

  await maybeUpdateMigrationState("UserPerfumeComment", migrationStart, comments.length, stats.errors - errorsAtStart)
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

  const errorsAtStart = stats.errors
  let processed = 0
  for (const notification of notifications) {
    try {
      await acceleratePrisma.wishlistNotification.upsert({
        where: { id: notification.id },
        update: {
          userId: mapUserId(notification.userId),
          perfumeId: notification.perfumeId,
          notifiedAt: notification.notifiedAt,
          updatedAt: notification.updatedAt,
        },
        create: {
          id: notification.id,
          userId: mapUserId(notification.userId),
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
    processed++
    if (processed % 500 === 0) {
      console.log(`  📊 Progress: ${processed}/${notifications.length} notifications (${stats.errors} errors)`)
    }
  }
  console.log(`  📊 Final: ${processed}/${notifications.length} notifications (${stats.errors} errors)`)

  await maybeUpdateMigrationState("WishlistNotification", migrationStart, notifications.length, stats.errors - errorsAtStart)
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
