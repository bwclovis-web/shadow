#!/usr/bin/env node

/**
 * Apply string-level translations to locale files for keys missing from en.json sync.
 * Reads paths from sync-translations-diff.js output and maps English → locale via
 * scripts/i18n-string-translations.json.
 *
 * Usage:
 *   node scripts/sync-translations-apply.js
 *   node scripts/sync-translations-apply.js --dry-run
 */

import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const messagesDir = join(__dirname, "../messages")
const TARGET_LOCALES = ["es", "fr", "it"]
const dryRun = process.argv.includes("--dry-run")

const stringTranslations = JSON.parse(
  readFileSync(join(__dirname, "i18n-string-translations.json"), "utf8")
)

const pathOverlays = JSON.parse(
  readFileSync(join(__dirname, "i18n-path-overlays.json"), "utf8")
)

/** Path-specific overrides (fixes, keys not in diff by English lookup) */
const pathOverrides = {
  fr: {
    "contactTrader.itemSubject": "Demande concernant {perfumeName}{perfumeHouse}",
    "singlePerfume.similarPerfumes": "Parfums similaires",
  },
  it: {
    "contactTrader.itemSubheading":
      "Contatta il trader riguardo {perfumeName}{perfumeHouse}.",
    "singlePerfume.similarPerfumes": "Profumi simili",
  },
}

/** @param {Record<string, unknown>} obj @param {string} path */
const getNested = (obj, path) =>
  path.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return /** @type {Record<string, unknown>} */ (acc)[part]
    }
    return undefined
  }, /** @type {unknown} */ (obj))

/** @param {Record<string, unknown>} obj @param {string} path @param {string} value */
const setNested = (obj, path, value) => {
  const parts = path.split(".")
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {}
    }
    current = /** @type {Record<string, unknown>} */ (current[part])
  }
  current[parts[parts.length - 1]] = value
}

const diffJson = execSync("node scripts/sync-translations-diff.js --json", {
  cwd: join(__dirname, ".."),
  encoding: "utf8",
})
const diff = JSON.parse(diffJson)

let applied = 0
let skipped = 0

for (const locale of TARGET_LOCALES) {
  const filePath = join(messagesDir, `${locale}.json`)
  const messages = JSON.parse(readFileSync(filePath, "utf8"))
  const localeStrings = stringTranslations[locale] ?? {}
  const overrides = pathOverrides[locale] ?? {}

  for (const { path, en } of diff[locale].missing) {
    const translated =
      overrides[path] ?? localeStrings[en] ?? stringTranslations.en?.[en]

    if (!translated) {
      console.warn(`[${locale}] No translation for: ${path} → ${JSON.stringify(en)}`)
      skipped++
      continue
    }

    setNested(messages, path, translated)
    applied++
  }

  for (const [path, value] of Object.entries(overrides)) {
    if (getNested(messages, path) !== value) {
      setNested(messages, path, value)
      applied++
    }
  }

  for (const [path, localeValues] of Object.entries(pathOverlays)) {
    const value = localeValues[locale]
    if (value && getNested(messages, path) !== value) {
      setNested(messages, path, value)
      applied++
    }
  }

  if (!dryRun) {
    writeFileSync(filePath, `${JSON.stringify(messages, null, 2)}\n`, "utf8")
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Updated messages/${locale}.json`)
}

console.log(`Applied ${applied} translations${skipped ? `, skipped ${skipped}` : ""}`)

if (skipped > 0) {
  process.exit(1)
}
