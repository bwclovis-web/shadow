// Fix script for UserPerfumeComment foreign key issues
// Run this AFTER the main migration completes

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
  console.log("🔄 Fixing UserPerfumeComment foreign key issues...")
  
  await localClient.connect()
  
  // Get all comments from local
  const result = await localClient.query('SELECT * FROM "UserPerfumeComment" ORDER BY "createdAt" ASC')
  const comments = result.rows
  
  console.log(`Found ${comments.length} comments to check`)
  
  let fixed = 0
  let skipped = 0
  let errors = 0
  
  for (const comment of comments) {
    try {
      // Check if userPerfumeId exists in remote
      const userPerfumeExists = await remotePrisma.userPerfume.findUnique({
        where: { id: comment.userPerfumeId },
        select: { id: true },
      })
      
      if (!userPerfumeExists) {
        console.log(`  ⚠️  Skipping comment ${comment.id} - userPerfume ${comment.userPerfumeId} doesn't exist`)
        skipped++
        continue
      }
      
      // Try to create/update
      await remotePrisma.userPerfumeComment.upsert({
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
      
      fixed++
    } catch (error) {
      errors++
      console.error(`  ❌ Error fixing comment ${comment.id}:`, error.message)
    }
  }
  
  console.log(`\n✅ Done!`)
  console.log(`   Fixed: ${fixed}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Errors: ${errors}`)
  
  await localClient.end()
  await remotePrisma.$disconnect()
}

main()
