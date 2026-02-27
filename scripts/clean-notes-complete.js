#!/usr/bin/env node

/**
 * Complete Note Cleaning Workflow
 * 
 * This script orchestrates the entire note cleaning process:
 * 1. Runs JavaScript rule-based dry-run
 * 2. Extracts ambiguous notes
 * 3. Runs AI extraction on ambiguous notes
 * 4. Generates a comprehensive markdown report
 * 
 * Usage:
 *   node scripts/clean-notes-complete.js --dry-run  # Preview changes
 *   node scripts/clean-notes-complete.js --confirm-apply            # Apply changes (after backup!)
 *   node scripts/clean-notes-complete.js --confirm-apply --apply-ai --recheck-duplicates
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const reportsDir = join(projectRoot, 'reports')
const backupsDir = join(projectRoot, 'backups')
const BACKUP_MAX_AGE_MINUTES = 120

/** Path to .venv-ai in project root (for AI step; use Python 3.10–3.12 to avoid numpy build issues). */
const VENV_AI_DIR = join(projectRoot, '.venv-ai')

/**
 * Return the Python executable to use for clean-notes-ai.py.
 * Uses .venv-ai if present (recommended: create with Python 3.11 or 3.12), otherwise "python".
 */
function getPythonForAI() {
  const isWin = process.platform === 'win32'
  const venvPython = join(VENV_AI_DIR, isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')
  if (existsSync(venvPython)) {
    return venvPython
  }
  return 'python'
}

function runCommand(command, description) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔄 ${description}`)
  console.log('='.repeat(60))
  try {
    execSync(command, { 
      stdio: 'inherit',
      cwd: projectRoot,
      env: { ...process.env }
    })
    return true
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    return false
  }
}

function findLatestReport(pattern, minTime = 0) {
  try {
    // Convert glob pattern to regex
    const regexPattern = pattern.replace(/\*/g, '.*')
    const regex = new RegExp(regexPattern)
    
    const files = readdirSync(reportsDir)
      .filter(f => regex.test(f))
      .map(f => ({
        name: f,
        path: join(reportsDir, f),
        time: statSync(join(reportsDir, f)).mtime.getTime()
      }))
      .filter(f => f.time >= minTime)
      .sort((a, b) => b.time - a.time)
    
    return files.length > 0 ? files[0].path : null
  } catch (error) {
    console.warn(`⚠️  Could not find report with pattern ${pattern}: ${error.message}`)
    return null
  }
}

function findLatestBackupManifest() {
  try {
    const files = readdirSync(backupsDir)
      .filter(f => /^backup_.*_manifest\.json$/.test(f))
      .map(f => ({
        name: f,
        path: join(backupsDir, f),
        time: statSync(join(backupsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)

    return files.length > 0 ? files[0] : null
  } catch (error) {
    console.warn(`⚠️  Could not scan backups folder: ${error.message}`)
    return null
  }
}

function validateRecentBackup(maxAgeMinutes = BACKUP_MAX_AGE_MINUTES) {
  const latestManifest = findLatestBackupManifest()
  if (!latestManifest) {
    return {
      ok: false,
      reason: `No backup manifest found in ${backupsDir}`
    }
  }

  const now = Date.now()
  const ageMinutes = (now - latestManifest.time) / (1000 * 60)
  if (ageMinutes > maxAgeMinutes) {
    return {
      ok: false,
      reason: `Latest backup is ${Math.round(ageMinutes)} minute(s) old (limit: ${maxAgeMinutes} minutes)`,
      manifestPath: latestManifest.path
    }
  }

  return {
    ok: true,
    manifestPath: latestManifest.path,
    ageMinutes: Math.round(ageMinutes)
  }
}

function extractAmbiguousNotes(reportPath) {
  console.log(`\n📖 Extracting ambiguous notes from: ${reportPath}`)
  
  const reportContent = readFileSync(reportPath, 'utf-8')
  const ambiguousNotes = []
  
  // Extract ALL descriptive phrases - they should all go to AI for better handling
  const extractableSection = reportContent.match(/### Phrases with Extractable Notes[\s\S]*?(?=###|##|$)/)
  if (extractableSection) {
    // Try to match with type column to identify descriptive phrases
    const tableRowsWithType = [...extractableSection[0].matchAll(/\| "([^"]+)" \|.*?\| (descriptive|extractable|stopword-prefix|slash-separated|multiple-distinct|suffix-removal) \|/g)]
    for (const match of tableRowsWithType) {
      const phrase = match[1]
      const type = match[2]
      
      // Send ALL descriptive phrases to AI (they need better handling)
      if (type === 'descriptive') {
        ambiguousNotes.push({
          name: phrase,
          reason: 'Descriptive phrase - AI extraction recommended'
        })
      }
    }
    
    // Also catch all phrases in the table (fallback if type matching fails)
    const allPhraseRows = [...extractableSection[0].matchAll(/\| "([^"]+)" \|/g)]
    for (const match of allPhraseRows) {
      const phrase = match[1]
      // If it looks like a descriptive phrase, send to AI
      if (isDescriptivePhrase(phrase)) {
        // Avoid duplicates
        if (!ambiguousNotes.find(n => n.name === phrase)) {
          ambiguousNotes.push({
            name: phrase,
            reason: 'Complex descriptive phrase - AI extraction recommended'
          })
        }
      }
    }
  }
  
  // Extract invalid notes that might have extractable content
  // Send descriptive-ai type notes to AI
  const invalidSection = reportContent.match(/### Invalid Notes[\s\S]*?(?=###|##|$)/)
  if (invalidSection) {
    const tableRows = [...invalidSection[0].matchAll(/\| "([^"]+)" \|.*?\| (descriptive|descriptive-ai|stopword) \|/g)]
    for (const match of tableRows) {
      const phrase = match[1]
      const type = match[2]
      
      // Send descriptive-ai and descriptive types to AI
      if (type === 'descriptive-ai' || type === 'descriptive' || mightHaveExtractableNotes(phrase)) {
        if (!ambiguousNotes.find(n => n.name === phrase)) {
          ambiguousNotes.push({
            name: phrase,
            reason: `Marked as ${type} but might have extractable notes - AI extraction recommended`
          })
        }
      }
    }
  }
  
  // Extract "Notes to Confirm" — multi-word notes (e.g. hot leather, old makeup) sent to AI to confirm valid
  const confirmSection = reportContent.match(/### Notes to Confirm \(AI Validation\)[\s\S]*?(?=###|##|$)/)
  if (confirmSection) {
    const confirmRows = [...confirmSection[0].matchAll(/\| "([^"]+)" \|\s*([^|]+)\s*\|\s*\d+\s*\|/g)]
    for (const match of confirmRows) {
      const phrase = match[1]
      if (!ambiguousNotes.find(n => n.name === phrase)) {
        ambiguousNotes.push({
          name: phrase,
          reason: 'Confirm valid scent note'
        })
      }
    }
  }
  
  return ambiguousNotes
}

function isDescriptivePhrase(phrase) {
  // Check if phrase looks like a descriptive phrase (not a simple note)
  // These should be sent to AI
  const descriptivePatterns = [
    /\d+s$/i, // Ends with decade
    /^(fallen|dripping|adding|capturing|luscious)/i, // Starts with descriptive words
    /(soaked|deep in|full of|amongst|getting ready)/i, // Contains descriptive phrases
    /(\.|!|"|'|\(|\)|\[|\])/, // Contains punctuation (often descriptive)
    /\s+(and|or|with|of|in|on|at|to|for|from|by)\s+/i, // Multiple connecting words
    /^base:/i, // Starts with "base:"
    /^top:/i, // Starts with "top:"
    /^middle:/i, // Starts with "middle:"
    /& more$/i, // Ends with "& more" (though we handle this with rules too)
  ]
  
  return descriptivePatterns.some(pattern => pattern.test(phrase))
}

function isAmbiguous(phrase) {
  const ambiguousPatterns = [
    /soaked in/i,
    /hints? of/i,
    /touch of/i,
    /along with/i,
    /the fabulous/i,
    /petites/i,
    /\d+s$/i,
    /spritzes/i,
    /inhale/i,
    /and.*and/i,
    /,.*,/i,
  ]
  return ambiguousPatterns.some(pattern => pattern.test(phrase))
}

function mightHaveExtractableNotes(phrase) {
  const extractablePatterns = [
    /soaked in/i,
    /hints? of/i,
    /touch of/i,
    /scent of/i,
    /notes? of/i,
    /\w+\s+\w+\s+\w+/,
  ]
  return extractablePatterns.some(pattern => pattern.test(phrase))
}

function generateCombinedReport(jsReportPath, aiResultsPath) {
  console.log(`\n📝 Generating combined markdown report...`)
  
  const jsReport = readFileSync(jsReportPath, 'utf-8')
  let aiResults = null
  
  if (existsSync(aiResultsPath)) {
    try {
      aiResults = JSON.parse(readFileSync(aiResultsPath, 'utf-8'))
    } catch (e) {
      console.warn(`⚠️  Could not parse AI results: ${e.message}`)
    }
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  
  let combinedReport = `# Complete Note Cleaning Report

**Generated:** ${new Date().toISOString()}

⚠️ **DRY RUN MODE** - No changes have been made to the database

---

## Overview

This report combines:
1. **Rule-Based Cleaning** (JavaScript script) - Handles duplicates, stopwords, simple patterns
2. **AI-Powered Extraction** (LangGraph) - Handles complex phrases and ambiguous cases

---

## Part 1: Rule-Based Cleaning Results

`
  
  // Extract summary from JS report
  const summaryMatch = jsReport.match(/## Summary[\s\S]*?(?=---|$)/)
  if (summaryMatch) {
    combinedReport += summaryMatch[0] + '\n\n'
  }
  
  // Add key sections from JS report
  const duplicateSection = jsReport.match(/## Phase 1: Duplicate Notes[\s\S]*?(?=##|$)/)
  if (duplicateSection) {
    combinedReport += `### Rule-Based: Duplicate Notes\n\n`
    combinedReport += `_See full details in: ${jsReportPath.split('/').pop()}_\n\n`
    
    // Extract summary stats
    const dupCount = (duplicateSection[0].match(/Found (\d+) duplicate group/i) || [])[1]
    if (dupCount) {
      combinedReport += `**Found ${dupCount} duplicate groups**\n\n`
    }
  }
  
  const invalidSection = jsReport.match(/## Phase 2: Invalid Characters[\s\S]*?(?=##|$)/)
  if (invalidSection) {
    combinedReport += `### Rule-Based: Invalid Characters\n\n`
    combinedReport += `_See full details in: ${jsReportPath.split('/').pop()}_\n\n`
  }
  
  const phraseSection = jsReport.match(/## Phase 3: Stopwords & Phrases[\s\S]*?(?=##|$)/)
  if (phraseSection) {
    combinedReport += `### Rule-Based: Stopwords & Phrases\n\n`
    combinedReport += `_See full details in: ${jsReportPath.split('/').pop()}_\n\n`
  }
  
  // Add AI results
  if (aiResults && aiResults.length > 0) {
    combinedReport += `---

## Part 2: AI-Powered Extraction Results

`
    
    const extractedCount = aiResults.filter(r => r.extracted_notes).length
    const deletedCount = aiResults.filter(r => r.should_delete && !r.extracted_notes).length
    const reviewCount = aiResults.length - extractedCount - deletedCount
    
    combinedReport += `### Summary

- **Total Notes Processed by AI:** ${aiResults.length}
- **Notes with Extracted Notes:** ${extractedCount}
- **Notes Marked for Deletion:** ${deletedCount}
- **Notes Requiring Review:** ${reviewCount}

---

### AI Extracted Notes

| Original Phrase | Extracted Note(s) | Reasoning |
|-----------------|-------------------|----------|
`
    
    aiResults
      .filter(r => r.extracted_notes)
      .forEach(result => {
        const phrase = result.original_phrase || result.name || ''
        const notes = Array.isArray(result.extracted_notes) 
          ? result.extracted_notes.join(', ') 
          : result.extracted_notes || ''
        const reasoning = (result.reasoning || '').substring(0, 100)
        combinedReport += `| "${phrase}" | "${notes}" | ${reasoning}... |\n`
      })
    
    combinedReport += `\n### AI Notes Marked for Deletion\n\n`
    combinedReport += `| Original Phrase | Reasoning |\n`
    combinedReport += `|-----------------|----------|\n`
    
    aiResults
      .filter(r => r.should_delete && !r.extracted_notes)
      .forEach(result => {
        const phrase = result.original_phrase || result.name || ''
        const reasoning = (result.reasoning || 'No extractable notes').substring(0, 100)
        combinedReport += `| "${phrase}" | ${reasoning}... |\n`
      })
    
    if (reviewCount > 0) {
      combinedReport += `\n### AI Notes Requiring Manual Review\n\n`
      combinedReport += `| Original Phrase | Reasoning |\n`
      combinedReport += `|-----------------|----------|\n`
      
      aiResults
        .filter(r => !r.extracted_notes && !r.should_delete)
        .forEach(result => {
          const phrase = result.original_phrase || result.name || ''
          const reasoning = (result.reasoning || 'No action determined').substring(0, 100)
          combinedReport += `| "${phrase}" | ${reasoning}... |\n`
        })
    }
  } else {
    combinedReport += `---

## Part 2: AI-Powered Extraction Results

⚠️ No AI extraction was performed or no ambiguous notes were found.

`
  }
  
  combinedReport += `---

## Next Steps

1. Review both rule-based and AI extraction results above
2. Verify all extracted notes are correct
3. Check notes marked for deletion
4. Manually review notes requiring attention
5. Run without \`--dry-run\` to apply changes (after backup)

**⚠️ Remember to backup first:**
\`\`\`bash
npm run db:backup
\`\`\`

**To apply changes:**
\`\`\`bash
node scripts/clean-notes.js
\`\`\`

---

## Report Files

- **Rule-Based Report:** \`${jsReportPath.split('/').pop()}\`
- **AI Results JSON:** \`${aiResultsPath.split('/').pop()}\`
- **This Combined Report:** \`complete-note-cleaning-${timestamp}.md\`
`
  
  return combinedReport
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')
  const applyAI = process.argv.includes('--apply-ai')
  const recheckDuplicates = process.argv.includes('--recheck-duplicates')
  const confirmApply = process.argv.includes('--confirm-apply')
  const skipBackupCheck = process.argv.includes('--skip-backup-check')
  
  console.log('='.repeat(60))
  console.log('🧹 Complete Note Cleaning Workflow')
  console.log('='.repeat(60))
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n')
  } else {
    if (!confirmApply) {
      console.error('❌ Refusing to run non-dry-run without explicit confirmation.')
      console.error('   Re-run with: --confirm-apply')
      console.error('   Example: npm run clean:notes:complete:full')
      process.exit(1)
    }

    if (!skipBackupCheck) {
      const backupCheck = validateRecentBackup()
      if (!backupCheck.ok) {
        console.error('❌ Safety check failed: recent backup required before apply.')
        console.error(`   Reason: ${backupCheck.reason}`)
        console.error('   Run: npm run db:backup')
        console.error('   Then re-run cleanup apply command.')
        process.exit(1)
      }
      console.log(`✅ Backup safety check passed (${backupCheck.ageMinutes} min old): ${backupCheck.manifestPath}\n`)
    } else {
      console.warn('⚠️  Backup recency check was skipped (--skip-backup-check)\n')
    }
  }
  
  if (applyAI && !isDryRun) {
    console.log('🤖 AI recommendations will be automatically applied\n')
  }
  
  if (recheckDuplicates && !isDryRun) {
    console.log('🔍 Duplicate detection will be re-run after AI application\n')
  }
  
  // Step 1: Run JavaScript cleaning. When applying, we must run dry-run FIRST to get a
  // fresh report (clean-notes.js only writes a report in dry-run). Then we use that
  // report for ambiguous extraction and run the actual apply.
  const runApply = !isDryRun && confirmApply
  const jsDryRunSuccess = runCommand(
    'node scripts/clean-notes.js --dry-run',
    `Running JavaScript Rule-Based Cleaning (DRY RUN)${runApply ? ' - to produce report before apply' : ''}`
  )
  if (!jsDryRunSuccess) {
    console.error('❌ JavaScript dry-run failed. Stopping.')
    process.exit(1)
  }

  const jsReportPath = findLatestReport('clean-notes-dry-run-*.md')
  if (!jsReportPath) {
    console.error('❌ Could not find JavaScript dry-run report')
    process.exit(1)
  }
  console.log(`✅ Found report: ${jsReportPath}`)

  if (runApply) {
    console.log(`\n📋 Step 1b: Applying rule-based cleaning (JavaScript)...`)
    const jsApplySuccess = runCommand(
      'node scripts/clean-notes.js',
      'Running JavaScript Rule-Based Cleaning (ACTUAL)'
    )
    if (!jsApplySuccess) {
      console.error('❌ JavaScript apply failed. Stopping.')
      process.exit(1)
    }
  }
  
  // Step 3: Extract ambiguous notes
  console.log('\n📋 Step 2/4: Extracting ambiguous notes...')
  const ambiguousNotes = extractAmbiguousNotes(jsReportPath)
  
  if (ambiguousNotes.length === 0) {
    console.log('✅ No ambiguous notes found. Skipping AI extraction.')
    
    // Still generate combined report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const combinedReport = generateCombinedReport(jsReportPath, '')
    const combinedPath = join(reportsDir, `complete-note-cleaning-${timestamp}.md`)
    writeFileSync(combinedPath, combinedReport, 'utf-8')
    console.log(`\n✅ Combined report saved: ${combinedPath}`)
    return
  }
  
  console.log(`✅ Found ${ambiguousNotes.length} ambiguous notes`)
  
  // Save ambiguous notes
  const ambiguousPath = join(reportsDir, 'ambiguous-notes.json')
  writeFileSync(ambiguousPath, JSON.stringify(ambiguousNotes, null, 2), 'utf-8')
  console.log(`✅ Saved to: ${ambiguousPath}`)
  
  // Step 4: Run AI extraction (always dry-run for AI, it only generates reports)
  const pythonForAI = getPythonForAI()
  if (pythonForAI !== 'python') {
    console.log(`\n🐍 Using .venv-ai Python: ${pythonForAI}`)
  }
  console.log('\n📋 Step 3/4: Running AI-powered extraction...')
  const aiStepStartedAt = Date.now()
  const pythonCmd = pythonForAI.includes(' ') ? `"${pythonForAI}"` : pythonForAI
  const aiSuccess = runCommand(
    `${pythonCmd} scripts/clean-notes-ai.py --input ${ambiguousPath} --dry-run`,
    'Running AI-Powered Extraction (Analysis Only)'
  )
  
  if (!aiSuccess) {
    console.warn('⚠️  AI extraction failed. Continuing with rule-based results only.')
  }
  
  // Step 5: Find AI results
  const aiResultsPattern = 'ai-note-extraction-*.json'
  const aiResultsPath = aiSuccess
    ? (findLatestReport(aiResultsPattern, aiStepStartedAt) || '')
    : ''
  
  // Step 6: Apply AI recommendations (if requested and not dry-run)
  let aiApplied = false
  if (applyAI && !isDryRun && aiResultsPath) {
    console.log('\n📋 Step 4/5: Applying AI recommendations...')
    const applyAISuccess = runCommand(
      `node scripts/apply-ai-recommendations.js ${aiResultsPath}`,
      'Applying AI-Generated Recommendations'
    )
    
    if (applyAISuccess) {
      aiApplied = true
      console.log('✅ AI recommendations applied successfully')
    } else {
      console.warn('⚠️  Failed to apply AI recommendations. Continuing...')
    }
  }
  
  // Step 7: Re-check duplicates (if requested and not dry-run)
  if (recheckDuplicates && !isDryRun) {
    console.log('\n📋 Step 5/5: Re-checking for duplicates...')
    const duplicateCheckSuccess = runCommand(
      'node scripts/clean-notes.js --duplicates-only',
      'Re-running Duplicate Detection (Duplicates Only)'
    )
    
    if (duplicateCheckSuccess) {
      console.log('✅ Duplicate check completed')
    } else {
      console.warn('⚠️  Duplicate check failed. You may want to run it manually.')
    }
  }
  
  // Step 8: Generate combined report
  const stepNumber = aiApplied || recheckDuplicates ? '6' : '4'
  const totalSteps = aiApplied && recheckDuplicates ? '6' : (aiApplied || recheckDuplicates ? '5' : '4')
  console.log(`\n📋 Step ${stepNumber}/${totalSteps}: Generating combined markdown report...`)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const combinedReport = generateCombinedReport(jsReportPath, aiResultsPath)
  const combinedPath = join(reportsDir, `complete-note-cleaning-${timestamp}.md`)
  writeFileSync(combinedPath, combinedReport, 'utf-8')
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ Complete Workflow Finished!')
  console.log('='.repeat(60))
  console.log(`\n📄 Reports Generated:`)
  console.log(`   • Rule-Based: ${jsReportPath.split(/[/\\]/).pop()}`)
  if (aiResultsPath) {
    console.log(`   • AI Results: ${aiResultsPath.split(/[/\\]/).pop()}`)
  }
  console.log(`   • Combined Report: ${combinedPath.split(/[/\\]/).pop()}`)
  
  if (isDryRun) {
    console.log(`\n💡 This was a DRY RUN - No changes were made to the database.`)
    console.log(`\n📋 To apply changes:`)
    console.log(`   1. Review the combined report above`)
    console.log(`   2. Backup your database: npm run db:backup`)
    console.log(`   3. Run: npm run clean:notes:complete:apply`)
    if (aiResultsPath) {
      console.log(`   4. Apply AI recommendations: node scripts/apply-ai-recommendations.js ${aiResultsPath.split(/[/\\]/).pop()}`)
      console.log(`   5. Re-check duplicates: npm run clean:notes`)
    }
  } else {
    console.log(`\n✅ Changes have been applied to the database!`)
    if (aiApplied) {
      console.log(`   ✅ AI recommendations were applied`)
    } else if (aiResultsPath) {
      console.log(`   ⚠️  AI recommendations were NOT applied (use --apply-ai flag)`)
    }
    if (recheckDuplicates) {
      console.log(`   ✅ Duplicate detection was re-run`)
    } else if (aiApplied) {
      console.log(`   ⚠️  Duplicate detection was NOT re-run (use --recheck-duplicates flag)`)
    }
    console.log(`\n💡 If you need to rollback: npm run db:restore`)
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
