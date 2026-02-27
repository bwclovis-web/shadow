// Check migration status and data counts
import { PrismaClient } from "@prisma/client"
import { Client } from "pg"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL
const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

const localClient = new Client({ connectionString: LOCAL_DATABASE_URL })
const remotePrisma = new PrismaClient({
  datasources: { db: { url: REMOTE_DATABASE_URL } },
})

const main = async () => {
  console.log("📊 Checking Migration Status...\n")
  
  await localClient.connect()
  
  try {
    // Check schema - try to query updatedAt
    console.log("🔍 Checking Remote Schema...")
    try {
      const testQuery = await remotePrisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'UserPerfume' 
        AND column_name = 'updatedAt'
      `
      
      if (testQuery.length > 0) {
        console.log("   ✅ Remote schema has updatedAt column")
      } else {
        console.log("   ❌ Remote schema MISSING updatedAt column")
        console.log("   👉 You need to push the schema first!")
        console.log("      1. Edit .env and set DATABASE_URL to REMOTE_DATABASE_URL")
        console.log("      2. Run: npx prisma db push")
        console.log("      3. Restore DATABASE_URL to local")
        console.log("")
      }
    } catch (error) {
      console.log("   ⚠️  Error checking schema:", error.message)
    }
    
    // Count perfumes
    console.log("\n📊 Counting Records...")
    
    const localResult = await localClient.query('SELECT COUNT(*) FROM "Perfume"')
    const localCount = parseInt(localResult.rows[0].count)
    
    const remoteCount = await remotePrisma.perfume.count()
    
    console.log(`\n   Local Perfumes:  ${localCount.toLocaleString()}`)
    console.log(`   Remote Perfumes: ${remoteCount.toLocaleString()}`)
    console.log(`   Missing:         ${(localCount - remoteCount).toLocaleString()}`)
    
    // Count perfume houses
    const localHousesResult = await localClient.query('SELECT COUNT(*) FROM "PerfumeHouse"')
    const localHouses = parseInt(localHousesResult.rows[0].count)
    const remoteHouses = await remotePrisma.perfumeHouse.count()
    
    console.log(`\n   Local Houses:    ${localHouses.toLocaleString()}`)
    console.log(`   Remote Houses:   ${remoteHouses.toLocaleString()}`)
    console.log(`   Missing:         ${(localHouses - remoteHouses).toLocaleString()}`)
    
    // Count users
    const localUsersResult = await localClient.query('SELECT COUNT(*) FROM "User"')
    const localUsers = parseInt(localUsersResult.rows[0].count)
    const remoteUsers = await remotePrisma.user.count()
    
    console.log(`\n   Local Users:     ${localUsers.toLocaleString()}`)
    console.log(`   Remote Users:    ${remoteUsers.toLocaleString()}`)
    console.log(`   Missing:         ${(localUsers - remoteUsers).toLocaleString()}`)
    
    // Check for perfumes with missing house references
    console.log("\n🔍 Checking Data Quality...")
    
    const orphanedPerfumes = await localClient.query(`
      SELECT COUNT(*) 
      FROM "Perfume" p 
      WHERE p."perfumeHouseId" IS NOT NULL 
      AND NOT EXISTS (
        SELECT 1 FROM "PerfumeHouse" h 
        WHERE h.id = p."perfumeHouseId"
      )
    `)
    
    const orphanCount = parseInt(orphanedPerfumes.rows[0].count)
    if (orphanCount > 0) {
      console.log(`   ⚠️  ${orphanCount} perfumes reference non-existent houses`)
    } else {
      console.log(`   ✅ All perfumes have valid house references`)
    }
    
    // Check migration state
    console.log("\n📋 Migration State...")
    try {
      const migrationStates = await remotePrisma.migrationState.findMany({
        orderBy: { lastMigratedAt: 'desc' }
      })
      
      if (migrationStates.length === 0) {
        console.log("   ⚠️  No migration state found (first migration?)")
      } else {
        console.log("   Last migrations:")
        migrationStates.slice(0, 5).forEach(state => {
          console.log(`      ${state.tableName}: ${state.recordCount} records at ${state.lastMigratedAt.toLocaleString()}`)
        })
      }
    } catch (error) {
      console.log("   ❌ Cannot read migration state:", error.message)
    }
    
    console.log("\n" + "=".repeat(60))
    
    if (remoteCount < localCount) {
      console.log("\n⚠️  MISMATCH DETECTED!")
      console.log("\nPossible causes:")
      console.log("1. Schema not pushed (updatedAt missing) - CHECK ABOVE")
      console.log("2. Migration errors (check logs for 'Error migrating')")
      console.log("3. Foreign key constraint violations")
      console.log("4. Duplicate slug conflicts")
      console.log("\nTo fix:")
      console.log("1. Push schema if updatedAt missing (see above)")
      console.log("2. Run: node scripts/migrate-to-accelerate-fixed.js --full")
      console.log("3. Check logs for errors")
    } else {
      console.log("\n✅ All data migrated successfully!")
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message)
  } finally {
    await localClient.end()
    await remotePrisma.$disconnect()
  }
}

main()
