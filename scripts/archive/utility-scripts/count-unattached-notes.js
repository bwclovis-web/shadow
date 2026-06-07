#!/usr/bin/env node

/**
 * Count notes that are NOT attached to any perfume
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function countUnattachedNotes() {
  try {
    // Get all notes with their relation counts
    const notes = await prisma.perfumeNotes.findMany({
      include: {
        _count: {
          select: {
            perfumeNoteRelations: true,
          },
        },
      },
    })

    // Filter notes with no relations
    const unattachedNotes = notes.filter(
      (note) => note._count.perfumeNoteRelations === 0
    )

    console.log(`\n📊 Notes Analysis:`)
    console.log(`Total notes: ${notes.length}`)
    console.log(`Notes attached to perfumes: ${notes.length - unattachedNotes.length}`)
    console.log(`Notes NOT attached to any perfume: ${unattachedNotes.length}\n`)

    if (unattachedNotes.length > 0) {
      console.log(`Unattached notes:`)
      unattachedNotes.forEach((note) => {
        console.log(`  - ${note.name} (ID: ${note.id})`)
      })
    }

    return unattachedNotes.length
  } catch (error) {
    console.error("Error counting unattached notes:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

countUnattachedNotes()
  .then((count) => {
    console.log(`\n✅ Done! Found ${count} unattached notes.`)
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })

