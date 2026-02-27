#!/usr/bin/env node

/**
 * Script to copy images from app/images to public/images for build
 * Optionally converts PNG files to WebP format
 * Optimized to only copy files that have changed
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const sourceDir = join(__dirname, "../app/images")
const targetDir = join(__dirname, "../public/images")

// Check if PNG to WebP conversion is enabled via environment variable
const CONVERT_PNG_TO_WEBP = process.env.CONVERT_PNG_TO_WEBP === "true"

/**
 * Check if a file needs to be copied (source is newer than target or target doesn't exist)
 */
function needsCopy(sourcePath, targetPath) {
  try {
    const sourceStat = statSync(sourcePath)
    const targetStat = statSync(targetPath, { throwIfNoEntry: false })
    
    if (!targetStat) {
      return true // Target doesn't exist, need to copy
    }
    
    // Copy if source is newer than target
    return sourceStat.mtimeMs > targetStat.mtimeMs
  } catch {
    return true // Error checking, safe to copy
  }
}

async function copyImages() {
  try {
    // Quick check: if source directory doesn't exist, exit early
    const sourceStat = statSync(sourceDir, { throwIfNoEntry: false })
    if (!sourceStat) {
      console.log("⚠️  Source directory not found:", sourceDir)
      return
    }

    // Create target directory if it doesn't exist
    const targetStat = statSync(targetDir, { throwIfNoEntry: false })
    if (!targetStat) {
      mkdirSync(targetDir, { recursive: true })
      console.log("✅ Created public/images directory")
    }

    // Read source directory
    const files = readdirSync(sourceDir)
    
    if (files.length === 0) {
      return // No files to process, exit early
    }

    let copiedCount = 0
    let convertedCount = 0
    let skippedCount = 0

    // Process PNG files first if conversion is enabled
    const pngFiles = files.filter(file => file.toLowerCase().endsWith(".png"))
    const otherFiles = files.filter(file => file.match(/\.(webp|jpg|jpeg|svg|gif|ico)$/i))

    if (CONVERT_PNG_TO_WEBP && pngFiles.length > 0) {
      try {
        // Dynamic import to avoid loading Sharp if not needed
        const { convertPngToWebP, getOptimizedOptions } = await import("../app/utils/imageConversion.js")

        for (const file of pngFiles) {
          const sourcePath = join(sourceDir, file)
          const webpFileName = file.replace(/\.png$/i, ".webp")
          const targetPath = join(targetDir, webpFileName)

          // Check if conversion is needed
          if (!needsCopy(sourcePath, targetPath)) {
            skippedCount++
            continue
          }

          const result = await convertPngToWebP(
            sourcePath,
            targetPath,
            getOptimizedOptions("web")
          )

          if (result.success) {
            convertedCount++
            console.log(`🔄 Converted: ${file} → ${webpFileName} (${result.compressionRatio.toFixed(1)}% smaller)`)
          } else {
            console.log(`⚠️  Failed to convert ${file}, copying original: ${result.error}`)
            copyFileSync(sourcePath, join(targetDir, file))
            copiedCount++
          }
        }
      } catch (error) {
        console.log(`⚠️  WebP conversion failed, falling back to copying PNG files: ${error.message}`)
        // Fallback: copy PNG files as-is
        for (const file of pngFiles) {
          const sourcePath = join(sourceDir, file)
          const targetPath = join(targetDir, file)
          
          if (!needsCopy(sourcePath, targetPath)) {
            skippedCount++
            continue
          }
          
          copyFileSync(sourcePath, targetPath)
          copiedCount++
        }
      }
    } else {
      // Copy PNG files normally if conversion is disabled
      for (const file of pngFiles) {
        const sourcePath = join(sourceDir, file)
        const targetPath = join(targetDir, file)
        
        if (!needsCopy(sourcePath, targetPath)) {
          skippedCount++
          continue
        }
        
        copyFileSync(sourcePath, targetPath)
        copiedCount++
      }
    }

    // Copy other image files
    for (const file of otherFiles) {
      const sourcePath = join(sourceDir, file)
      const targetPath = join(targetDir, file)

      if (!needsCopy(sourcePath, targetPath)) {
        skippedCount++
        continue
      }

      copyFileSync(sourcePath, targetPath)
      copiedCount++
    }

    const totalProcessed = copiedCount + convertedCount
    if (skippedCount > 0 && totalProcessed === 0) {
      // All files were up to date, no need to log
      // Only log in verbose mode
      if (process.env.VERBOSE_IMAGES === "true") {
        console.log(`ℹ️  All ${files.length} image files are up to date`)
      }
      return
    }
    
    // Only log if something was actually processed
    if (convertedCount > 0) {
      console.log(`✅ Processed ${totalProcessed} image files (${convertedCount} converted, ${copiedCount} copied${skippedCount > 0 ? `, ${skippedCount} skipped` : ""})`)
    } else if (copiedCount > 0) {
      console.log(`✅ Copied ${copiedCount} image files${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}`)
    }
  } catch (error) {
    console.error("❌ Error copying images:", error.message)
    process.exit(1)
  }
}

copyImages()
