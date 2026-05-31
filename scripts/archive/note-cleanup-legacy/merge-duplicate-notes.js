#!/usr/bin/env node

/**
 * Merge Duplicate Notes Script
 * Finds and merges duplicate notes with case-insensitive matching
 * Ensures one note like "oud" can be used for multiple perfumes in different types
 * 
 * Run with: node scripts/merge-duplicate-notes.js
 * Dry run: node scripts/merge-duplicate-notes.js --dry-run
 */

import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"
import { join } from "path"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

// Load environment variables
process.env.DOTENV_CONFIG_QUIET = "true"
dotenv.config({ path: join(projectRoot, ".env") })

const prisma = new PrismaClient()

const isDryRun = process.argv.includes("--dry-run")

async function mergeDuplicateNotes() {
  try {
    console.log("🔍 Finding duplicate notes...\n")
    
    if (isDryRun) {
      console.log("⚠️  DRY RUN MODE - No changes will be made\n")
    }

    // Get all notes grouped by normalized name (lowercase, trimmed)
    const allNotes = await prisma.perfumeNotes.findMany({
      orderBy: { createdAt: "asc" }, // Keep the oldest one
    })

    // Group by normalized name
    const notesByName = new Map()
    const duplicates = []

    for (const note of allNotes) {
      const normalizedName = note.name.trim().toLowerCase()
      
      if (!notesByName.has(normalizedName)) {
        notesByName.set(normalizedName, [note])
      } else {
        notesByName.get(normalizedName).push(note)
      }
    }

    // Find groups with multiple notes (duplicates)
    for (const [normalizedName, notes] of notesByName.entries()) {
      if (notes.length > 1) {
        duplicates.push({
          normalizedName,
          notes: notes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        })
      }
    }

    if (duplicates.length === 0) {
      console.log("✅ No duplicate notes found!")
      return
    }

    console.log(`📊 Found ${duplicates.length} duplicate group(s):\n`)
    
    let totalNotesToMerge = 0
    for (const dup of duplicates) {
      totalNotesToMerge += dup.notes.length - 1 // Keep one, merge the rest
      console.log(`  "${dup.normalizedName}" (${dup.notes.length} variants):`)
      dup.notes.forEach((note, index) => {
        const keep = index === 0 ? " (KEEP)" : " (MERGE)"
        console.log(`    ${index + 1}. "${note.name}" (${note.id})${keep}`)
      })
      console.log("")
    }

    console.log(`\n📋 Summary: ${totalNotesToMerge} notes will be merged into ${duplicates.length} master notes`)
    console.log("   This ensures one note can be reused across multiple perfumes.\n")

    if (isDryRun) {
      console.log("✅ Dry run complete. Use without --dry-run to apply changes.")
      return
    }

    console.log("🔄 Starting merge process...\n")

    let mergedCount = 0
    let errorCount = 0

    for (const dup of duplicates) {
      const masterNote = dup.notes[0] // Oldest note
      const notesToMerge = dup.notes.slice(1) // All others

      console.log(`\n📦 Merging "${dup.normalizedName}"`)
      console.log(`   Master: "${masterNote.name}" (${masterNote.id})`)

      for (const duplicateNote of notesToMerge) {
        try {
          console.log(`   → Merging "${duplicateNote.name}" (${duplicateNote.id})`)

          // Check what relationships the duplicate has
          const duplicateRelations = {
            open: duplicateNote.perfumeOpenId,
            heart: duplicateNote.perfumeHeartId,
            close: duplicateNote.perfumeCloseId,
          }

          // Update master note to include all relationships from duplicate
          const updateData = {}
          
          // Only update if master doesn't have that relationship and duplicate does
          if (!masterNote.perfumeOpenId && duplicateNote.perfumeOpenId) {
            updateData.perfumeOpenId = duplicateNote.perfumeOpenId
            console.log(`     Adding open note link: ${duplicateNote.perfumeOpenId}`)
          }
          
          if (!masterNote.perfumeHeartId && duplicateNote.perfumeHeartId) {
            updateData.perfumeHeartId = duplicateNote.perfumeHeartId
            console.log(`     Adding heart note link: ${duplicateNote.perfumeHeartId}`)
          }
          
          if (!masterNote.perfumeCloseId && duplicateNote.perfumeCloseId) {
            updateData.perfumeCloseId = duplicateNote.perfumeCloseId
            console.log(`     Adding close note link: ${duplicateNote.perfumeCloseId}`)
          }

          // Update master note if there are relationships to preserve
          if (Object.keys(updateData).length > 0) {
            await prisma.perfumeNotes.update({
              where: { id: masterNote.id },
              data: updateData,
            })
            // Refresh master note for next iteration
            Object.assign(masterNote, updateData)
          }

          // Note: In the current schema, we can't merge relationships when both notes
          // have different perfumes for the same type. This will be resolved when we
          // migrate to junction table (PerfumeNoteRelation) in Phase 5.
          if (
            (masterNote.perfumeOpenId && duplicateNote.perfumeOpenId && masterNote.perfumeOpenId !== duplicateNote.perfumeOpenId) ||
            (masterNote.perfumeHeartId && duplicateNote.perfumeHeartId && masterNote.perfumeHeartId !== duplicateNote.perfumeHeartId) ||
            (masterNote.perfumeCloseId && duplicateNote.perfumeCloseId && masterNote.perfumeCloseId !== duplicateNote.perfumeCloseId)
          ) {
            console.log(`     ⚠️  Warning: Both notes have different perfume links for same type`)
            console.log(`        This conflict will be resolved in Phase 5 migration to junction table`)
            console.log(`        Duplicate note will be deleted, but relationship data may be lost`)
            console.log(`        Consider reviewing these manually before migration`)
          }

          // Delete the duplicate note
          await prisma.perfumeNotes.delete({
            where: { id: duplicateNote.id },
          })

          mergedCount++
          console.log(`     ✅ Merged successfully`)
        } catch (error) {
          errorCount++
          console.error(`     ❌ Error merging: ${error.message}`)
        }
      }
    }

    console.log(`\n${"=".repeat(60)}`)
    console.log(`\n✅ Merge complete!`)
    console.log(`   Merged: ${mergedCount} duplicate notes`)
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`)
    }
    console.log(`\n📝 Note: This ensures one note (e.g., "oud") can be reused`)
    console.log(`   across multiple perfumes. Full many-to-many relationships`)
    console.log(`   will be enabled after Phase 5 migration to junction table.`)

  } catch (error) {
    console.error("\n❌ Merge failed:", error.message)
    throw error
  }
}

async function main() {
  try {
    await mergeDuplicateNotes()
  } catch (error) {
    console.error("Failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("merge-duplicate-notes.js")) {
  main()
}

export { mergeDuplicateNotes }



