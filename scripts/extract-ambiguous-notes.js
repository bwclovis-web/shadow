#!/usr/bin/env node

/**
 * Extract ambiguous notes from the JavaScript dry-run report
 * 
 * This script parses the markdown dry-run report and identifies notes that
 * might benefit from AI extraction (complex phrases, ambiguous cases).
 * 
 * Usage:
 *   node scripts/extract-ambiguous-notes.js <dry-run-report.md> [output.json]
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

function extractAmbiguousNotes(reportPath) {
  const reportContent = readFileSync(reportPath, 'utf-8')
  const ambiguousNotes = []
  
  // Extract phrases from "Phrases with Extractable Notes" section
  const extractableSection = reportContent.match(/### Phrases with Extractable Notes[\s\S]*?(?=###|##|$)/)
  if (extractableSection) {
    const tableRows = extractableSection[0].matchAll(/\| "([^"]+)" \|/g)
    for (const match of tableRows) {
      const phrase = match[1]
      // Consider phrases that might need AI review
      if (isAmbiguous(phrase)) {
        ambiguousNotes.push({
          name: phrase,
          reason: 'Complex phrase requiring AI extraction'
        })
      }
    }
  }
  
  // Extract invalid notes that might have extractable content
  const invalidSection = reportContent.match(/### Invalid Notes[\s\S]*?(?=###|##|$)/)
  if (invalidSection) {
    const tableRows = invalidSection[0].matchAll(/\| "([^"]+)" \|/g)
    for (const match of tableRows) {
      const phrase = match[1]
      // Check if it might have extractable notes despite being marked invalid
      if (mightHaveExtractableNotes(phrase)) {
        ambiguousNotes.push({
          name: phrase,
          reason: 'Marked invalid but might have extractable notes'
        })
      }
    }
  }
  
  return ambiguousNotes
}

function isAmbiguous(phrase) {
  // Phrases that are likely to benefit from AI extraction
  const ambiguousPatterns = [
    /soaked in/i,
    /hints? of/i,
    /touch of/i,
    /along with/i,
    /the fabulous/i,
    /petites/i,
    /\d+s$/i, // Ends with decade
    /spritzes/i,
    /inhale/i,
    /and.*and/i, // Multiple "and"s
    /,.*,/i, // Multiple commas
  ]
  
  return ambiguousPatterns.some(pattern => pattern.test(phrase))
}

function mightHaveExtractableNotes(phrase) {
  // Invalid notes that might still have extractable content
  const extractablePatterns = [
    /soaked in/i,
    /hints? of/i,
    /touch of/i,
    /scent of/i,
    /notes? of/i,
    /\w+\s+\w+\s+\w+/, // Multi-word phrases
  ]
  
  return extractablePatterns.some(pattern => pattern.test(phrase))
}

function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error('Usage: node scripts/extract-ambiguous-notes.js <dry-run-report.md> [output.json]')
    console.error('\nExample:')
    console.error('  node scripts/extract-ambiguous-notes.js reports/clean-notes-dry-run-2025-12-19T13-36-29.md')
    process.exit(1)
  }
  
  const reportPath = args[0]
  const outputPath = args[1] || join(projectRoot, 'reports', 'ambiguous-notes.json')
  
  try {
    console.log(`📖 Reading dry-run report: ${reportPath}`)
    const ambiguousNotes = extractAmbiguousNotes(reportPath)
    
    if (ambiguousNotes.length === 0) {
      console.log('✅ No ambiguous notes found in the report.')
      return
    }
    
    console.log(`\n🔍 Found ${ambiguousNotes.length} ambiguous notes:`)
    ambiguousNotes.slice(0, 10).forEach((note, i) => {
      console.log(`   ${i + 1}. "${note.name}"`)
    })
    if (ambiguousNotes.length > 10) {
      console.log(`   ... and ${ambiguousNotes.length - 10} more`)
    }
    
    // Save to JSON
    writeFileSync(outputPath, JSON.stringify(ambiguousNotes, null, 2), 'utf-8')
    console.log(`\n✅ Saved to: ${outputPath}`)
    console.log(`\n💡 Next step: Run AI extraction:`)
    console.log(`   python scripts/clean-notes-ai.py --input ${outputPath} --dry-run`)
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

main()
