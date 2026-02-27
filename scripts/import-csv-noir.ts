// Import script for CSV files in csv_noir directory
// Handles duplicates intelligently:
// - Same house: update existing with missing info
// - Different house: append "-house name"
// - Uses existing notes from database
// - Only creates new notes when needed

import { PerfumeNoteType, PrismaClient } from "@prisma/client"
import { parse } from "csv-parse/sync"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const prisma = new PrismaClient()

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Slug creation function
const createUrlSlug = (name: string): string => {
  if (!name || typeof name !== "string") {
    return ""
  }

  return (
    name
      .replace(/%20/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2026]/g, "...")
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/\s+/g, "-")
      .replace(/_/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
  )
}

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
    return notesString
      .split(",")
      .map(note => note.trim())
      .filter(note => note.length > 0)
  }
}

async function importCsv(
  filePath: string,
  importFunction: (data: any) => Promise<void>
) {
  const content = fs.readFileSync(filePath, { encoding: "utf-8" })
  const records = parse(content, { columns: true, skip_empty_lines: true })

  console.log(`Importing ${records.length} records from ${path.basename(filePath)}`)

  for (let i = 0; i < records.length; i++) {
    try {
      await importFunction(records[i])
      if ((i + 1) % 50 === 0) {
        console.log(`  Processed ${i + 1} of ${records.length} records`)
      }
    } catch (error) {
      console.error(`Error processing record ${i + 1}:`, error)
      console.error("Record data:", records[i])
    }
  }
  console.log(`✅ Completed importing ${records.length} records from ${path.basename(filePath)}`)
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

async function importPerfumeData(csvFiles: string[], baseDir: string) {
  const resolvedBaseDir = path.isAbsolute(baseDir)
    ? baseDir
    : path.join(__dirname, "..", baseDir.replace(/^\.\//, ""))

  for (const csvFile of csvFiles) {
    const filePath = path.join(resolvedBaseDir, csvFile)

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${csvFile}`)
      continue
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
          const bestExisting = scoredPerfumes.reduce((best, current) => current.score > best.score ? current : best)
          
          const newScore = calculateDataCompleteness(data)
          
          // If we have duplicates, delete the ones with less data
          if (sameHousePerfumes.length > 1) {
            console.log(`Found ${sameHousePerfumes.length} duplicates in same house for "${perfumeName}"`)
            for (const { perfume: p } of scoredPerfumes) {
              if (p.id !== bestExisting.perfume.id) {
                console.log(`  Deleting duplicate perfume with less data: ${p.id}`)
                await prisma.perfume.delete({ where: { id: p.id } })
              }
            }
          }
          
          // Always prefer enriched noir text when provided
          const updateData: any = {}
          if (data.description) {
            const newDescription = data.description.trim()
            const currentDescription = bestExisting.perfume.description?.trim()
            if (!currentDescription || currentDescription !== newDescription) {
              updateData.description = newDescription || null
            }
          }
          if (data.image) {
            const newImage = data.image.trim()
            const currentImage = bestExisting.perfume.image?.trim()
            if (!currentImage || currentImage !== newImage) {
              updateData.image = newImage || null
            }
          }

          if (Object.keys(updateData).length > 0) {
            console.log(`Updating existing perfume "${perfumeName}" from same house with enriched data`)
            perfume = await prisma.perfume.update({
              where: { id: bestExisting.perfume.id },
              data: updateData,
            })
          } else {
            // Existing remains the same, but still add any missing notes
            perfume = bestExisting.perfume
            console.log(`  Existing perfume "${perfumeName}" already up to date; checking notes`)
          }
        } else {
          // Different house - append house name
          const houseName = data.perfumeHouse ? data.perfumeHouse.trim() : "Unknown"
          const newName = `${perfumeName} - ${houseName}`
          
          // Check if the renamed version already exists
          const renamedExists = await prisma.perfume.findFirst({
            where: { name: newName },
          })
          
          if (renamedExists) {
            console.log(`Renamed perfume "${newName}" already exists, skipping...`)
            return
          }
          
          console.log(`Renaming "${perfumeName}" to "${newName}" (different house)`)
          
          const slug = createUrlSlug(newName)
          let finalSlug = slug
          let counter = 1
          while (await prisma.perfume.findUnique({ where: { slug: finalSlug } })) {
            finalSlug = `${slug}-${counter}`
            counter++
          }
          
          perfume = await prisma.perfume.create({
            data: {
              name: newName,
              description: data.description || null,
              image: data.image || null,
              perfumeHouseId: houseId,
              slug: finalSlug,
            },
          })
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
        
        perfume = await prisma.perfume.create({
          data: {
            name: perfumeName,
            description: data.description || null,
            image: data.image || null,
            perfumeHouseId: houseId,
            slug: finalSlug,
          },
        })
      }

      // Process notes
      const openNotes = parseNotes(data.openNotes || "")
      const heartNotes = parseNotes(data.heartNotes || "")
      const baseNotes = parseNotes(data.baseNotes || "")

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
}

async function main() {
  console.log("🚀 Starting CSV import from csv_noir...")

  // Get CSV file name from command line argument
  const args = process.argv.slice(2)
  const dirArgIndex = args.findIndex(arg => arg.startsWith("--dir="))
  let baseDir = "../csv_noir"

  if (dirArgIndex !== -1) {
    baseDir = args[dirArgIndex].replace("--dir=", "") || baseDir
    args.splice(dirArgIndex, 1)
  }

  const csvFileName = args[0]

  if (!csvFileName) {
    console.error("❌ Please provide a CSV file name as an argument")
    console.error("Usage: npm run import-csv-noir [--dir=../csv_noir] <filename.csv>")
    console.error("Example: npm run import-csv-noir perfumes_kyse.csv")
    console.error("Example: npm run import-csv-noir -- --dir=../csv perfumes_histoires-de-parfums.csv")
    
    // List available CSV files
    const csvDir = path.isAbsolute(baseDir)
      ? baseDir
      : path.join(__dirname, baseDir)
    if (fs.existsSync(csvDir)) {
      const files = fs.readdirSync(csvDir)
      const csvFiles = files.filter(file => file.endsWith(".csv") && file !== "README.md")
      console.log("\nAvailable CSV files:")
      csvFiles.forEach(file => console.log(`  - ${file}`))
    }
    
    process.exit(1)
  }

  const csvFiles = [csvFileName]
  console.log(`Importing CSV file: ${csvFileName} from directory ${baseDir}`)

  await importPerfumeData(csvFiles, baseDir)

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

