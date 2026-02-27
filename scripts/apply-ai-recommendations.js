#!/usr/bin/env node

/**
 * Apply AI-Generated Note Extraction Recommendations
 * 
 * This script reads AI extraction results and applies them to the database:
 * - Extracts notes from phrases (creates new notes, reassociates relations)
 * - Deletes notes marked for deletion
 * 
 * Usage:
 *   node scripts/apply-ai-recommendations.js <ai-results.json> --dry-run
 *   node scripts/apply-ai-recommendations.js <ai-results.json>
 */

import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { normalizeName, normalizeForDuplicateDetection, findNoteByNormalizedMatch } from './note-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

// Load environment variables
process.env.DOTENV_CONFIG_QUIET = "true"
dotenv.config({ path: join(projectRoot, ".env") })

// Use same DB as dev app when running locally (app uses LOCAL_DATABASE_URL in development)
if (process.env.NODE_ENV !== "production" && process.env.LOCAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL
}

const prisma = new PrismaClient()

const isDryRun = process.argv.includes("--dry-run")

/**
 * Apply AI recommendations to the database
 */
async function applyAIRecommendations(resultsFile) {
  console.log("=".repeat(60))
  console.log("🤖 Apply AI-Generated Recommendations")
  console.log("=".repeat(60))
  
  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made\n")
  }
  
  // Load AI results
  console.log(`📖 Loading AI results from: ${resultsFile}\n`)
  const results = JSON.parse(readFileSync(resultsFile, 'utf-8'))
  
  if (!Array.isArray(results)) {
    throw new Error("AI results must be an array")
  }
  
  // Filter to only results with actions
  const actionableResults = results.filter(r => 
    (r.extracted_notes && (Array.isArray(r.extracted_notes) ? r.extracted_notes.length > 0 : r.extracted_notes)) ||
    (r.should_delete && !r.extracted_notes)
  )
  
  console.log(`📊 Found ${actionableResults.length} actionable recommendations out of ${results.length} total\n`)
  
  if (actionableResults.length === 0) {
    console.log("✅ No actionable recommendations to apply")
    return
  }
  
  // Group by action type
  const extractActions = actionableResults.filter(r => r.extracted_notes && !r.should_delete)
  const deleteActions = actionableResults.filter(r => r.should_delete && !r.extracted_notes)
  
  console.log(`   • Notes to extract: ${extractActions.length}`)
  console.log(`   • Notes to delete: ${deleteActions.length}\n`)
  
  if (isDryRun) {
    console.log("📋 Preview of changes:\n")
    
    if (extractActions.length > 0) {
      console.log("Extraction Actions:")
      extractActions.slice(0, 10).forEach((action, i) => {
        const notes = Array.isArray(action.extracted_notes) ? action.extracted_notes : [action.extracted_notes]
        console.log(`   ${i + 1}. "${action.original_phrase || action.name}" → ${notes.map(n => `"${n}"`).join(', ')}`)
      })
      if (extractActions.length > 10) {
        console.log(`   ... and ${extractActions.length - 10} more`)
      }
      console.log("")
    }
    
    if (deleteActions.length > 0) {
      console.log("Deletion Actions:")
      deleteActions.slice(0, 10).forEach((action, i) => {
        console.log(`   ${i + 1}. "${action.original_phrase || action.name}" → DELETE`)
      })
      if (deleteActions.length > 10) {
        console.log(`   ... and ${deleteActions.length - 10} more`)
      }
      console.log("")
    }
    
    console.log("✅ Dry run complete. Run without --dry-run to apply changes.")
    return
  }
  
  // Apply changes
  console.log("🔄 Applying changes...\n")
  
  let extractedCount = 0
  let deletedCount = 0
  let relationsReassociated = 0
  let errors = []
  
  // Use transaction for safety
  await prisma.$transaction(async (tx) => {
    // Process extraction actions
    for (const action of extractActions) {
      try {
        const originalPhrase = action.original_phrase || action.name
        const extractedNotes = Array.isArray(action.extracted_notes) 
          ? action.extracted_notes 
          : [action.extracted_notes]
        
        console.log(`\n🔧 Processing: "${originalPhrase}" → ${extractedNotes.map(n => `"${n}"`).join(', ')}`)
        
        // Find the original note
        const originalNote = await tx.perfumeNotes.findFirst({
          where: {
            name: originalPhrase
          },
          include: {
            perfumeNoteRelations: true
          }
        })
        
        if (!originalNote) {
          console.log(`   ⚠️  Note not found in database, skipping`)
          continue
        }
        
        const relations = originalNote.perfumeNoteRelations
        console.log(`   Found ${relations.length} relations to reassociate`)
        
        // Find or create target notes (with duplicate detection)
        const targetNotes = []
        for (const extractedNoteName of extractedNotes) {
          // First, try exact match (case-sensitive)
          let targetNote = await tx.perfumeNotes.findUnique({
            where: { name: extractedNoteName }
          })
          
          // If not found, check for case-insensitive or space/hyphen variations
          if (!targetNote) {
            // Get all notes and check for normalized matches
            const allNotes = await tx.perfumeNotes.findMany()
            const matchingNote = findNoteByNormalizedMatch(allNotes, extractedNoteName)
            
            if (matchingNote) {
              targetNote = matchingNote
              console.log(`   ✅ Found existing note (normalized match): "${matchingNote.name}" (matches "${extractedNoteName}")`)
            }
          } else {
            console.log(`   ✅ Found existing note: "${extractedNoteName}"`)
          }
          
          // Create if still not found
          if (!targetNote) {
            targetNote = await tx.perfumeNotes.create({
              data: { name: extractedNoteName }
            })
            console.log(`   ✅ Created note: "${extractedNoteName}"`)
          }
          
          targetNotes.push(targetNote)
        }
        
        // Reassociate relations to all target notes
        for (const relation of relations) {
          let relationProcessed = false
          
          for (const targetNote of targetNotes) {
            // Check if target note already has this relation
            const existingRelation = await tx.perfumeNoteRelation.findUnique({
              where: {
                perfumeId_noteId_noteType: {
                  perfumeId: relation.perfumeId,
                  noteId: targetNote.id,
                  noteType: relation.noteType
                }
              }
            })
            
            if (!existingRelation) {
              // Create relation to this extracted note
              await tx.perfumeNoteRelation.create({
                data: {
                  perfumeId: relation.perfumeId,
                  noteId: targetNote.id,
                  noteType: relation.noteType
                }
              })
              relationProcessed = true
              relationsReassociated++
            }
          }
          
          // Delete the original relation
          await tx.perfumeNoteRelation.delete({
            where: { id: relation.id }
          })
          
          if (relationProcessed) {
            console.log(`   → Reassociated relation to ${targetNotes.length} extracted note(s)`)
          } else {
            console.log(`   → Removed relation (all extracted notes already have this relation)`)
          }
        }
        
        // Delete the original phrase note
        await tx.perfumeNotes.delete({
          where: { id: originalNote.id }
        })
        
        console.log(`   ✅ Extracted ${extractedNotes.length} note(s) and reassociated ${relations.length} relations`)
        extractedCount++
        
      } catch (error) {
        console.error(`   ❌ Error processing: ${error.message}`)
        errors.push({ action, error: error.message })
      }
    }
    
    // Process deletion actions
    for (const action of deleteActions) {
      try {
        const phrase = action.original_phrase || action.name
        
        console.log(`\n🗑️  Deleting: "${phrase}"`)
        
        // Find the note
        const note = await tx.perfumeNotes.findFirst({
          where: { name: phrase },
          include: {
            perfumeNoteRelations: true
          }
        })
        
        if (!note) {
          console.log(`   ⚠️  Note not found in database, skipping`)
          continue
        }
        
        const relationCount = note.perfumeNoteRelations.length
        console.log(`   Found ${relationCount} relations (will be deleted via CASCADE)`)
        
        // Delete note (CASCADE will remove relations)
        await tx.perfumeNotes.delete({
          where: { id: note.id }
        })
        
        console.log(`   ✅ Deleted note and ${relationCount} relations`)
        deletedCount++
        
      } catch (error) {
        console.error(`   ❌ Error deleting: ${error.message}`)
        errors.push({ action, error: error.message })
      }
    }
  })
  
  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("✅ Application Complete")
  console.log("=".repeat(60))
  console.log(`\n📊 Summary:`)
  console.log(`   • Notes extracted: ${extractedCount}`)
  console.log(`   • Notes deleted: ${deletedCount}`)
  console.log(`   • Relations reassociated: ${relationsReassociated}`)
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`)
    errors.forEach(({ action, error }) => {
      console.log(`   • "${action.original_phrase || action.name}": ${error}`)
    })
  }
  
  // Post-application duplicate check
  console.log("\n" + "=".repeat(60))
  console.log("🔍 Checking for duplicates introduced by AI extraction...")
  console.log("=".repeat(60))
  
  const allNotesAfter = await prisma.perfumeNotes.findMany({
    include: {
      perfumeNoteRelations: true
    }
  })
  
  // Group by normalized name (using space-to-hyphen normalization)
  const notesByNormalized = new Map()
  for (const note of allNotesAfter) {
    const normalized = normalizeForDuplicateDetection(note.name)
    if (!notesByNormalized.has(normalized)) {
      notesByNormalized.set(normalized, [])
    }
    notesByNormalized.get(normalized).push(note)
  }
  
  // Find duplicates
  const newDuplicates = []
  for (const [normalized, notes] of notesByNormalized.entries()) {
    if (notes.length > 1) {
      newDuplicates.push({ normalized, notes })
    }
  }
  
  if (newDuplicates.length > 0) {
    console.log(`\n⚠️  Found ${newDuplicates.length} duplicate group(s) that may have been introduced:\n`)
    newDuplicates.forEach((dup, i) => {
      console.log(`   ${i + 1}. "${dup.normalized}" (${dup.notes.length} variants):`)
      dup.notes.forEach((note, j) => {
        const relationCount = note.perfumeNoteRelations.length
        console.log(`      • "${note.name}" (ID: ${note.id}, Relations: ${relationCount})`)
      })
    })
    console.log(`\n💡 Recommendation: Run duplicate detection to merge these:`)
    console.log(`   npm run clean:notes:dry-run`)
    console.log(`   npm run clean:notes`)
  } else {
    console.log(`\n✅ No new duplicates detected!`)
  }
  
  console.log(`\n💡 If you need to rollback: npm run db:restore`)
}

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== '--dry-run')
  
  if (args.length === 0) {
    console.error("Usage: node scripts/apply-ai-recommendations.js <ai-results.json> [--dry-run]")
    console.error("\nExample:")
    console.error("  node scripts/apply-ai-recommendations.js reports/ai-note-extraction-2025-12-19T08-55-19.json --dry-run")
    process.exit(1)
  }
  
  const resultsFile = args[0]
  
  try {
    await applyAIRecommendations(resultsFile)
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
