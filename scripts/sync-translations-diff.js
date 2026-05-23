#!/usr/bin/env node

/**
 * Compare messages/en.json against es, fr, and it locale files.
 * Reports missing keys, extra keys, and placeholder mismatches.
 *
 * Usage:
 *   node scripts/sync-translations-diff.js
 *   node scripts/sync-translations-diff.js --locale es
 *   node scripts/sync-translations-diff.js --json
 */

import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const messagesDir = join(__dirname, "../messages")
const SOURCE_LOCALE = "en"
const TARGET_LOCALES = ["es", "fr", "it"]

const args = process.argv.slice(2)
const jsonOutput = args.includes("--json")
const localeFilter = args.includes("--locale")
  ? args[args.indexOf("--locale") + 1]
  : null

const loadMessages = (locale) => {
  const filePath = join(messagesDir, `${locale}.json`)
  return JSON.parse(readFileSync(filePath, "utf8"))
}

/** @param {Record<string, unknown>} obj @param {string} [prefix] */
const flattenStrings = (obj, prefix = "") => {
  /** @type {Array<{ path: string, value: string }>} */
  const entries = []

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      entries.push(...flattenStrings(/** @type {Record<string, unknown>} */ (value), path))
    } else if (typeof value === "string") {
      entries.push({ path, value })
    }
  }

  return entries
}

/** @param {Record<string, unknown>} obj @param {string} path */
const getNested = (obj, path) =>
  path.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return /** @type {Record<string, unknown>} */ (acc)[part]
    }
    return undefined
  }, /** @type {unknown} */ (obj))

/** Extract ICU / next-intl placeholders from a string */
const extractPlaceholders = (value) => {
  const placeholders = new Set()

  for (const match of value.matchAll(/\{\{(\w+)\}\}/g)) {
    placeholders.add(`{{${match[1]}}}`)
  }

  for (const match of value.matchAll(/\{(\w+)\}/g)) {
    placeholders.add(`{${match[1]}}`)
  }

  for (const match of value.matchAll(/\{(\w+),\s*plural,/g)) {
    placeholders.add(`{${match[1]}, plural, ...}`)
  }

  for (const match of value.matchAll(/\{(\w+),\s*select,/g)) {
    placeholders.add(`{${match[1]}, select, ...}`)
  }

  return [...placeholders].sort()
}

/** @param {string} source @param {string} target */
const placeholderMismatch = (source, target) => {
  const sourcePlaceholders = extractPlaceholders(source)
  const targetPlaceholders = extractPlaceholders(target)

  const missing = sourcePlaceholders.filter((p) => !targetPlaceholders.includes(p))
  const extra = targetPlaceholders.filter((p) => !sourcePlaceholders.includes(p))

  if (missing.length === 0 && extra.length === 0) {
    return null
  }

  return { missing, extra }
}

const source = loadMessages(SOURCE_LOCALE)
const sourceEntries = flattenStrings(source)
const locales = localeFilter ? [localeFilter] : TARGET_LOCALES

/** @type {Record<string, { missing: Array<{ path: string, en: string }>, extra: string[], placeholderIssues: Array<{ path: string, en: string, value: string, missing: string[], extra: string[] }> }>} */
const report = {}

for (const locale of locales) {
  if (!TARGET_LOCALES.includes(locale)) {
    console.error(`Unknown locale "${locale}". Expected one of: ${TARGET_LOCALES.join(", ")}`)
    process.exit(1)
  }

  const target = loadMessages(locale)
  const targetPaths = new Set(flattenStrings(target).map((entry) => entry.path))

  const missing = sourceEntries
    .filter(({ path }) => getNested(target, path) === undefined)
    .map(({ path, value }) => ({ path, en: value }))

  const extra = [...targetPaths].filter((path) => getNested(source, path) === undefined)

  const placeholderIssues = sourceEntries
    .map(({ path, value }) => {
      const translated = getNested(target, path)
      if (typeof translated !== "string") {
        return null
      }

      const mismatch = placeholderMismatch(value, translated)
      if (!mismatch) {
        return null
      }

      return {
        path,
        en: value,
        value: translated,
        missing: mismatch.missing,
        extra: mismatch.extra,
      }
    })
    .filter(Boolean)

  report[locale] = { missing, extra, placeholderIssues }
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

let hasIssues = false

for (const locale of locales) {
  const { missing, extra, placeholderIssues } = report[locale]

  console.log(`\n=== ${locale.toUpperCase()} ===`)

  if (missing.length === 0 && extra.length === 0 && placeholderIssues.length === 0) {
    console.log("In sync with en.json")
    continue
  }

  hasIssues = true

  if (missing.length > 0) {
    console.log(`\nMissing keys (${missing.length}):`)
    for (const entry of missing) {
      console.log(`  ${entry.path}`)
      console.log(`    en: ${entry.en}`)
    }
  }

  if (extra.length > 0) {
    console.log(`\nExtra keys not in en.json (${extra.length}):`)
    for (const path of extra) {
      console.log(`  ${path}`)
    }
  }

  if (placeholderIssues.length > 0) {
    console.log(`\nPlaceholder mismatches (${placeholderIssues.length}):`)
    for (const issue of placeholderIssues) {
      console.log(`  ${issue.path}`)
      if (issue.missing.length > 0) {
        console.log(`    missing: ${issue.missing.join(", ")}`)
      }
      if (issue.extra.length > 0) {
        console.log(`    extra: ${issue.extra.join(", ")}`)
      }
    }
  }
}

if (hasIssues) {
  process.exit(1)
}
