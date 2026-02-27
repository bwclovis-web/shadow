// Find which houses are missing from remote database
import { PrismaClient } from "@prisma/client"
import { Client } from "pg"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const createUrlSlug = name => {
  if (!name || typeof name !== "string") return ""
  return name
    .replace(/%20/g, " ")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-zA-Z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL
const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

const localClient = new Client({ connectionString: LOCAL_DATABASE_URL })
const remotePrisma = new PrismaClient({
  datasources: { db: { url: REMOTE_DATABASE_URL } },
})

const main = async () => {
  console.log("🔍 Finding Missing Houses...\n")
  
  await localClient.connect()
  
  // Get all local houses
  const localResult = await localClient.query('SELECT * FROM "PerfumeHouse" ORDER BY name')
  const localHouses = localResult.rows
  
  console.log(`Found ${localHouses.length} houses in local database\n`)
  
  let missing = 0
  const missingHouses = []
  
  for (const house of localHouses) {
    const slug = createUrlSlug(house.name)
    
    // Check if exists in remote
    const remoteHouse = await remotePrisma.perfumeHouse.findUnique({
      where: { slug: slug },
      select: { id: true, name: true, slug: true },
    })
    
    if (!remoteHouse) {
      missing++
      missingHouses.push({
        id: house.id,
        name: house.name,
        slug: slug,
      })
    }
  }
  
  console.log(`\n📊 Results:`)
  console.log(`   Total Local Houses: ${localHouses.length}`)
  console.log(`   Missing from Remote: ${missing}\n`)
  
  if (missing > 0) {
    console.log(`❌ Missing Houses:`)
    missingHouses.forEach((house, idx) => {
      console.log(`   ${idx + 1}. "${house.name}"`)
      console.log(`      ID: ${house.id}`)
      console.log(`      Slug: ${house.slug}`)
      console.log(``)
    })
    
    // Check for duplicate slugs
    console.log(`\n🔍 Checking for Duplicate Slugs...`)
    const slugCounts = new Map()
    for (const house of localHouses) {
      const slug = createUrlSlug(house.name)
      slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1)
    }
    
    const duplicates = Array.from(slugCounts.entries()).filter(([_, count]) => count > 1)
    
    if (duplicates.length > 0) {
      console.log(`   ⚠️  Found ${duplicates.length} duplicate slugs:`)
      for (const [slug, count] of duplicates) {
        console.log(`      "${slug}" (${count} houses)`)
        
        // Find houses with this slug
        const housesWithSlug = localHouses.filter(h => createUrlSlug(h.name) === slug)
        housesWithSlug.forEach(h => {
          console.log(`         - "${h.name}" (ID: ${h.id})`)
        })
      }
      console.log(`\n   💡 Duplicate slugs cause conflicts. Only one house per slug can be migrated.`)
    } else {
      console.log(`   ✅ No duplicate slugs found`)
    }
  } else {
    console.log(`✅ All houses are in remote database!`)
  }
  
  await localClient.end()
  await remotePrisma.$disconnect()
}

main()
