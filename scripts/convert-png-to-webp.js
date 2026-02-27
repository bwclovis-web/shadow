#!/usr/bin/env node

/**
 * Batch PNG to WebP conversion script
 * Usage: node scripts/convert-png-to-webp.js [options]
 *
 * Options:
 *   --input <path>     Input directory or file (default: app/images)
 *   --output <path>    Output directory (default: public/images)
 *   --quality <number> WebP quality 1-100 (default: 80)
 *   --lossless         Use lossless compression
 *   --recursive        Process subdirectories recursively
 *   --delete-original  Delete original PNG files after conversion
 *   --use-case <type>  Optimized settings: web, mobile, print, thumbnail
 *   --dry-run          Show what would be converted without actually converting
 */

import { promises as fs } from "fs"
import { basename, dirname, join } from "path"
import { fileURLToPath } from "url"

import {
  convertMultiplePngToWebP,
  convertPngToWebP,
  findPngFiles,
  generateConversionReport,
  getOptimizedOptions,
  validateWebPSupport,
} from "../app/utils/imageConversion.ts"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    input: join(__dirname, "../app/images"),
    output: join(__dirname, "../public/images"),
    quality: 80,
    lossless: false,
    recursive: true,
    deleteOriginal: false,
    useCase: null,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case "--input":
        options.input = args[++i]
        break
      case "--output":
        options.output = args[++i]
        break
      case "--quality":
        options.quality = parseInt(args[++i], 10)
        break
      case "--lossless":
        options.lossless = true
        break
      case "--recursive":
        options.recursive = true
        break
      case "--delete-original":
        options.deleteOriginal = true
        break
      case "--use-case":
        options.useCase = args[++i]
        break
      case "--dry-run":
        options.dryRun = true
        break
      case "--help":
      case "-h":
        showHelp()
        process.exit(0)
        break
    }
  }

  return options
}

function showHelp() {
  console.log(`
PNG to WebP Batch Converter

Usage: node scripts/convert-png-to-webp.js [options]

Options:
  --input <path>        Input directory or file (default: app/images)
  --output <path>       Output directory (default: public/images)
  --quality <number>    WebP quality 1-100 (default: 80)
  --lossless           Use lossless compression
  --recursive          Process subdirectories recursively (default: true)
  --delete-original    Delete original PNG files after conversion
  --use-case <type>    Optimized settings: web, mobile, print, thumbnail
  --dry-run            Show what would be converted without actually converting
  --help, -h           Show this help message

Examples:
  # Convert all PNGs in app/images to public/images
  node scripts/convert-png-to-webp.js

  # Convert with mobile optimization
  node scripts/convert-png-to-webp.js --use-case mobile

  # Convert specific directory with high quality
  node scripts/convert-png-to-webp.js --input ./my-images --quality 95

  # Dry run to see what would be converted
  node scripts/convert-png-to-webp.js --dry-run

  # Convert and delete originals
  node scripts/convert-png-to-webp.js --delete-original
`)
}

async function main() {
  const options = parseArgs()

  console.log("🖼️  PNG to WebP Batch Converter")
  console.log("================================\n")

  // Validate WebP support
  console.log("🔍 Validating WebP support...")
  const webpSupported = await validateWebPSupport()
  if (!webpSupported) {
    console.error("❌ WebP support validation failed. Please ensure Sharp is properly installed.")
    process.exit(1)
  }
  console.log("✅ WebP support validated\n")

  try {
    // Check if input exists
    await fs.access(options.input)

    // Determine if input is file or directory
    const inputStat = await fs.stat(options.input)
    let pngFiles = []

    if (inputStat.isFile()) {
      if (options.input.toLowerCase().endsWith(".png")) {
        pngFiles = [options.input]
      } else {
        console.error("❌ Input file is not a PNG file")
        process.exit(1)
      }
    } else if (inputStat.isDirectory()) {
      if (options.recursive) {
        pngFiles = await findPngFiles(options.input)
      } else {
        const files = await fs.readdir(options.input)
        pngFiles = files
          .filter(file => file.toLowerCase().endsWith(".png"))
          .map(file => join(options.input, file))
      }
    }

    if (pngFiles.length === 0) {
      console.log("ℹ️  No PNG files found in the specified location")
      process.exit(0)
    }

    console.log(`📁 Found ${pngFiles.length} PNG file(s) to convert`)
    console.log(`📂 Input: ${options.input}`)
    console.log(`📂 Output: ${options.output} (and app/images)`)

    if (options.dryRun) {
      console.log("\n🔍 Dry run - files that would be converted:")
      pngFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file}`)
      })
      console.log(`\n📊 Would convert ${pngFiles.length} files`)
      return
    }

    // Prepare conversion options
    let conversionOptions = {}

    if (options.useCase) {
      conversionOptions = getOptimizedOptions(options.useCase)
      console.log(`⚙️  Using ${options.useCase} optimization settings`)
    } else {
      conversionOptions = {
        quality: options.quality,
        lossless: options.lossless,
      }
    }

    // Create output directory
    await fs.mkdir(options.output, { recursive: true })

    console.log("\n🚀 Starting conversion...\n")

    // Convert files to both app/images and public/images
    const results = []

    for (const pngFile of pngFiles) {
      // Convert to public/images (for web serving)
      const publicOutputPath = join(
        options.output,
        basename(pngFile, ".png") + ".webp"
      )
      const publicResult = await convertPngToWebP(
        pngFile,
        publicOutputPath,
        conversionOptions
      )
      results.push(publicResult)

      // Also convert to app/images (for development)
      const appImagesDir = join(__dirname, "../app/images")
      const appOutputPath = join(appImagesDir, basename(pngFile, ".png") + ".webp")
      const appResult = await convertPngToWebP(
        pngFile,
        appOutputPath,
        conversionOptions
      )
      results.push(appResult)
    }

    // Generate and display report
    const report = generateConversionReport(results)
    console.log(report)

    // Handle original file deletion
    if (options.deleteOriginal) {
      console.log("\n🗑️  Deleting original PNG files...")
      let deletedCount = 0

      for (const result of results) {
        if (result.success) {
          try {
            await fs.unlink(result.inputPath)
            deletedCount++
            console.log(`   ✅ Deleted: ${result.inputPath}`)
          } catch (error) {
            console.log(`   ⚠️  Could not delete: ${result.inputPath} - ${error.message}`)
          }
        }
      }

      console.log(`\n🗑️  Deleted ${deletedCount} original files`)
    }

    // Show summary
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    if (successful.length > 0) {
      console.log(`\n✅ Successfully converted ${successful.length} files`)
    }

    if (failed.length > 0) {
      console.log(`❌ Failed to convert ${failed.length} files`)
      process.exit(1)
    }

    console.log("\n🎉 Conversion completed successfully!")
  } catch (error) {
    console.error("❌ Error during conversion:", error.message)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Promise Rejection:", reason)
  process.exit(1)
})

// Run the script
main().catch(error => {
  console.error("❌ Script failed:", error.message)
  process.exit(1)
})
