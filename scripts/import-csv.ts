/**
 * Unified CSV Import Script for Perfume Database
 * 
 * This script handles importing perfume data from CSV files with intelligent duplicate handling:
 * - Same house: Updates existing perfumes with missing information
 * - Different house: Appends "-house name" to perfume name
 * - Uses existing notes from database (case-insensitive matching)
 * - Only creates new notes when needed
 * - Handles JSON descriptions with cleaned_description and extracted_notes
 * - Fixes image URLs (handles // and relative paths)
 * 
 * Usage:
 *   npm run import:csv <filename.csv> [--dir=<directory>]
 *   npm run import:csv perfumes_aromakaz.csv --dir=csv
 *   npm run import:csv perfumes_kyse.csv --dir=csv_noir
 */

import { PerfumeNoteType, PrismaClient } from "@prisma/client"
import { parse } from "csv-parse/sync"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { createUrlSlug } from "~/utils/slug"

const prisma = new PrismaClient()

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Calculate data completeness score
function calculateDataCompleteness(data: any): number {
  let score = 0
  if (data.description && data.description.trim()) {
    score += 10
  }
  if (data.image && data.image.trim()) {
    score += 10
  }
  const openNotes = parseNotes(data.openNotes || "")
  const heartNotes = parseNotes(data.heartNotes || "")
  const baseNotes = parseNotes(data.baseNotes || "")
  score += openNotes.length * 2
  score += heartNotes.length * 2
  score += baseNotes.length * 2
  return score
}

function parseNotes(notesString: string): string[] {
  if (!notesString || notesString.trim() === "" || notesString === "[]") {
    return []
  }

  try {
    const parsed = JSON.parse(notesString)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // If JSON parsing fails, try comma-separated
    return notesString
      .split(",")
      .map(note => note.trim().replace(/^["']|["']$/g, ""))
      .filter(note => note.length > 0)
  }
}

function parseDescription(descriptionString: string | null | undefined): { description: string | null; extractedNotes: string[] } {
  if (!descriptionString || descriptionString.trim() === "") {
    return { description: null, extractedNotes: [] }
  }

  const trimmed = descriptionString.trim()
  
  // Check if it's a JSON object with cleaned_description
  if (trimmed.startsWith("{") || trimmed.startsWith("{{")) {
    try {
      // Remove extra braces if present
      const cleaned = trimmed.replace(/^\{+|\}+$/g, "")
      const parsed = JSON.parse(cleaned)
      const description = parsed.cleaned_description ? parsed.cleaned_description.trim() : null
      const extractedNotes = Array.isArray(parsed.extracted_notes) ? parsed.extracted_notes : []
      return { description, extractedNotes }
    } catch {
      // If JSON parsing fails, return as-is
    }
  }
  
  return { description: trimmed, extractedNotes: [] }
}

function fixImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || imageUrl.trim() === "") {
    return null
  }

  let url = imageUrl.trim()
  
  // Fix URLs that start with //
  if (url.startsWith("//")) {
    url = "https:" + url
  }
  
  // Fix URLs that start with / (relative paths)
  if (url.startsWith("/") && !url.startsWith("http")) {
    // Try to extract domain from URL or use a default
    // For now, we'll leave relative paths as-is or you can configure a base URL
    // url = "https://example.com" + url
  }

  return url
}

async function importCsv(
  filePath: string,
  importFunction: (data: any) => Promise<void>
) {
  const content = fs.readFileSync(filePath, { encoding: "utf-8" })
  const records = parse(content, { columns: true, skip_empty_lines: true })

  console.log(`📦 Importing ${records.length} records from ${path.basename(filePath)}`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < records.length; i++) {
    try {
      await importFunction(records[i])
      successCount++
      if ((i + 1) % 50 === 0) {
        console.log(`  ⏳ Processed ${i + 1} of ${records.length} records`)
      }
    } catch (error) {
      errorCount++
      console.error(`❌ Error processing record ${i + 1}:`, error)
      console.error("   Record data:", records[i])
    }
  }
  
  console.log(`✅ Completed: ${successCount} successful, ${errorCount} errors`)
}

async function createOrGetPerfumeHouse(houseName: string) {
  if (!houseName || houseName.trim() === "") {
    return null
  }

  const trimmedName = houseName.trim()
  
  const existingHouse = await prisma.perfumeHouse.findUnique({
    where: { name: trimmedName },
  })

  if (existingHouse) {
    return existingHouse
  }

  const slug = createUrlSlug(trimmedName)
  
  // Check if slug exists, if so, append a number
  let finalSlug = slug
  let counter = 1
  while (await prisma.perfumeHouse.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${slug}-${counter}`
    counter++
  }

  return await prisma.perfumeHouse.create({
    data: {
      name: trimmedName,
      slug: finalSlug,
      type: "indie",
    },
  })
}

async function getOrCreateNote(noteName: string) {
  if (!noteName || noteName.trim() === "") {
    return null
  }

  const trimmedNoteName = noteName.trim().toLowerCase()

  // Try to find existing note (case-insensitive)
  let note = await prisma.perfumeNotes.findFirst({
    where: {
      name: {
        equals: trimmedNoteName,
        mode: "insensitive",
      },
    },
  })

  // If note doesn't exist, create it
  if (!note) {
    note = await prisma.perfumeNotes.create({
      data: {
        name: trimmedNoteName,
      },
    })
  }

  return note
}

async function createPerfumeNoteRelation(
  perfumeId: string,
  noteId: string,
  noteType: PerfumeNoteType
) {
  // Check if relation already exists
  const existing = await prisma.perfumeNoteRelation.findUnique({
    where: {
      perfumeId_noteId_noteType: {
        perfumeId,
        noteId,
        noteType,
      },
    },
  })

  if (!existing) {
    await prisma.perfumeNoteRelation.create({
      data: {
        perfumeId,
        noteId,
        noteType,
      },
    })
  }
}

async function importPerfumeData(csvFile: string, baseDir: string) {
  let resolvedBaseDir: string
  if (path.isAbsolute(baseDir)) {
    resolvedBaseDir = baseDir
  } else if (baseDir.startsWith("../") || baseDir.startsWith("..\\")) {
    // If baseDir already starts with ../, resolve it relative to __dirname directly
    resolvedBaseDir = path.resolve(__dirname, baseDir)
  } else {
    // Otherwise, resolve relative to project root (one level up from scripts)
    resolvedBaseDir = path.resolve(__dirname, "..", baseDir.replace(/^\.\//, ""))
  }

  const filePath = path.join(resolvedBaseDir, csvFile)

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    return
  }

  await importCsv(filePath, async data => {
    // Skip if name is empty
    if (!data.name || data.name.trim() === "") {
      return
    }

    // Create or get perfume house
    let perfumeHouse = null
    if (data.perfumeHouse) {
      perfumeHouse = await createOrGetPerfumeHouse(data.perfumeHouse)
    }

    const perfumeName = data.name.trim()
    const houseId = perfumeHouse?.id || null

    // Check for existing perfumes with the same name
    const existingPerfumes = await prisma.perfume.findMany({
      where: {
        name: perfumeName,
      },
      include: {
        perfumeNoteRelations: {
          include: {
            note: true,
          },
        },
      },
    })

    let perfume
    
    if (existingPerfumes.length > 0) {
      // Check if any existing perfumes are from the same house
      const sameHousePerfumes = existingPerfumes.filter(p => p.perfumeHouseId === houseId)

      if (sameHousePerfumes.length > 0) {
        // Same house - check for duplicates and keep the one with most data
        // Calculate scores for all existing perfumes
        const scoredPerfumes = sameHousePerfumes.map(p => {
          const score = calculateDataCompleteness({
            description: p.description,
            image: p.image,
            openNotes: JSON.stringify(p.perfumeNoteRelations
                .filter(r => r.noteType === "open")
                .map(r => r.note.name)),
            heartNotes: JSON.stringify(p.perfumeNoteRelations
                .filter(r => r.noteType === "heart")
                .map(r => r.note.name)),
            baseNotes: JSON.stringify(p.perfumeNoteRelations
                .filter(r => r.noteType === "base")
                .map(r => r.note.name)),
          })
          return { perfume: p, score }
        })
        
        // Find the one with the highest score
        const bestExisting = scoredPerfumes.reduce((best, current) => 
          current.score > best.score ? current : best
        )
        
        const newScore = calculateDataCompleteness(data)
        
        // If we have duplicates, delete the ones with less data
        if (sameHousePerfumes.length > 1) {
          console.log(`  🔄 Found ${sameHousePerfumes.length} duplicates in same house for "${perfumeName}"`)
          for (const { perfume: p } of scoredPerfumes) {
            if (p.id !== bestExisting.perfume.id) {
              console.log(`    🗑️  Deleting duplicate perfume with less data: ${p.id}`)
              await prisma.perfume.delete({ where: { id: p.id } })
            }
          }
        }
        
        // Always update to ensure we get the latest data (CSV is source of truth)
        const updateData: any = {}
        const { description: parsedDescription, extractedNotes: descriptionNotes } = parseDescription(data.description)
        
        // Always update description from CSV (even if null/empty)
        updateData.description = parsedDescription
        
        // Always update image from CSV
        updateData.image = data.image ? fixImageUrl(data.image) : null

        console.log(`  ✏️  Updating existing perfume "${perfumeName}" from same house`)
        perfume = await prisma.perfume.update({
          where: { id: bestExisting.perfume.id },
          data: updateData,
        })
      } else {
        // Different house - append house name
        const houseName = data.perfumeHouse ? data.perfumeHouse.trim() : "Unknown"
        const newName = `${perfumeName} - ${houseName}`
        
        // Check if the renamed version already exists
        const renamedExists = await prisma.perfume.findFirst({
          where: { name: newName },
          include: {
            perfumeNoteRelations: {
              include: {
                note: true,
              },
            },
          },
        })
        
        if (renamedExists) {
          // If renamed version exists and is from the same house, update it instead of skipping
          if (renamedExists.perfumeHouseId === houseId) {
            console.log(`  ✏️  Updating existing renamed perfume "${newName}" from same house`)
            
            // Always update to ensure we get the latest data (CSV is source of truth)
            const updateData: any = {}
            const { description: parsedDescription } = parseDescription(data.description)
            
            // Always update description from CSV (even if null/empty)
            updateData.description = parsedDescription
            
            // Always update image from CSV
            updateData.image = data.image ? fixImageUrl(data.image) : null
            
            perfume = await prisma.perfume.update({
              where: { id: renamedExists.id },
              data: updateData,
            })
          } else {
            console.log(`  ⏭️  Renamed perfume "${newName}" already exists with different house, skipping...`)
            return
          }
        } else {
          console.log(`  🔀 Creating new perfume "${newName}" (different house)`)
          
          const slug = createUrlSlug(newName)
          let finalSlug = slug
          let counter = 1
          while (await prisma.perfume.findUnique({ where: { slug: finalSlug } })) {
            finalSlug = `${slug}-${counter}`
            counter++
          }
          
          const { description: parsedDescription } = parseDescription(data.description)
          perfume = await prisma.perfume.create({
            data: {
              name: newName,
              description: parsedDescription,
              image: fixImageUrl(data.image),
              perfumeHouseId: houseId,
              slug: finalSlug,
            },
          })
        }
      }
    } else {
      // No existing perfume - create new one
      const slug = createUrlSlug(perfumeName)
      let finalSlug = slug
      let counter = 1
      while (await prisma.perfume.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${counter}`
        counter++
      }
      
      const { description: parsedDescription } = parseDescription(data.description)
      perfume = await prisma.perfume.create({
        data: {
          name: perfumeName,
          description: parsedDescription,
          image: fixImageUrl(data.image),
          perfumeHouseId: houseId,
          slug: finalSlug,
        },
      })
    }

    // Process notes
    let openNotes = parseNotes(data.openNotes || "")
    const heartNotes = parseNotes(data.heartNotes || "")
    const baseNotes = parseNotes(data.baseNotes || "")
    
    // If openNotes is empty, check if description has extracted_notes
    if (openNotes.length === 0) {
      const { extractedNotes: descriptionNotes } = parseDescription(data.description)
      if (descriptionNotes.length > 0) {
        openNotes = descriptionNotes
      }
    }

    // Always remove old note relations first (CSV is source of truth)
    // This ensures we get the latest cleaned notes from the CSV
    await prisma.perfumeNoteRelation.deleteMany({
      where: { perfumeId: perfume.id },
    })

    // Create note relations
    for (const noteName of openNotes) {
      const note = await getOrCreateNote(noteName)
      if (note) {
        await createPerfumeNoteRelation(perfume.id, note.id, "open")
      }
    }

    for (const noteName of heartNotes) {
      const note = await getOrCreateNote(noteName)
      if (note) {
        await createPerfumeNoteRelation(perfume.id, note.id, "heart")
      }
    }

    for (const noteName of baseNotes) {
      const note = await getOrCreateNote(noteName)
      if (note) {
        await createPerfumeNoteRelation(perfume.id, note.id, "base")
      }
    }
  })
}

async function main() {
  console.log("🚀 Starting CSV import...")

  // Get CSV file name from command line argument
  const args = process.argv.slice(2)
  const dirArgIndex = args.findIndex(arg => arg.startsWith("--dir="))
  let baseDir = "../csv"

  if (dirArgIndex !== -1) {
    baseDir = args[dirArgIndex].replace("--dir=", "") || baseDir
    args.splice(dirArgIndex, 1)
  }

  const csvFileName = args[0]

  if (!csvFileName) {
    console.error("❌ Please provide a CSV file name as an argument")
    console.error("")
    console.error("Usage:")
    console.error("  npm run import:csv <filename.csv> [--dir=<directory>]")
    console.error("")
    console.error("Examples:")
    console.error("  npm run import:csv perfumes_aromakaz.csv --dir=csv")
    console.error("  npm run import:csv perfumes_kyse.csv --dir=csv_noir")
    console.error("  npm run import:csv perfumes_dshperfumes.csv --dir=csv")
    console.error("")
    console.error("Options:")
    console.error("  --dir=<directory>  Specify the directory containing the CSV file")
    console.error("                    Default: ../csv")
    console.error("")
    
    // List available CSV files in common directories
    const commonDirs = ["csv", "csv_noir", "../csv", "../csv_noir"]
    for (const dir of commonDirs) {
      let csvDir: string
      if (path.isAbsolute(dir)) {
        csvDir = dir
      } else if (dir.startsWith("../") || dir.startsWith("..\\")) {
        csvDir = path.resolve(__dirname, dir)
      } else {
        csvDir = path.resolve(__dirname, "..", dir.replace(/^\.\//, ""))
      }
      if (fs.existsSync(csvDir)) {
        const files = fs.readdirSync(csvDir)
        const csvFiles = files.filter(file => file.endsWith(".csv"))
        if (csvFiles.length > 0) {
          console.log(`Available CSV files in ${dir}:`)
          csvFiles.forEach(file => console.log(`  - ${file}`))
          console.log("")
        }
      }
    }
    
    process.exit(1)
  }

  console.log(`📁 Importing CSV file: ${csvFileName} from directory ${baseDir}`)
  console.log("")

  await importPerfumeData(csvFileName, baseDir)

  console.log("")
  console.log("✅ CSV import completed!")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

