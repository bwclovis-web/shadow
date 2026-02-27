#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */

/**
 * Image optimization script
 * Converts images to WebP format and generates multiple sizes
 */

const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const IMAGE_DIR = path.join(__dirname, "../app/images")
const OUTPUT_DIR = path.join(__dirname, "../public/images/optimized")

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Image sizes for responsive images
const SIZES = [
320, 640, 768, 1024, 1280, 1536, 1920
]

// Quality settings
const QUALITY = {
  webp: 80,
  avif: 70,
  jpeg: 85,
}

async function optimizeImage(inputPath, outputDir) {
  const filename = path.basename(inputPath, path.extname(inputPath))
  const ext = path.extname(inputPath).toLowerCase()

  console.log(`Optimizing ${filename}${ext}...`)

  try {
    const image = sharp(inputPath)

    // Generate WebP versions
    for (const size of SIZES) {
      const outputPath = path.join(outputDir, `${filename}-${size}w.webp`)

      await image
        .resize(size, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
        .webp({ quality: QUALITY.webp })
        .toFile(outputPath)
    }

    // Generate AVIF versions (smaller file sizes)
    for (const size of SIZES) {
      const outputPath = path.join(outputDir, `${filename}-${size}w.avif`)

      await image
        .resize(size, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
        .avif({ quality: QUALITY.avif })
        .toFile(outputPath)
    }

    // Generate original size WebP
    const originalWebpPath = path.join(outputDir, `${filename}.webp`)
    await image.webp({ quality: QUALITY.webp }).toFile(originalWebpPath)

    // Generate original size AVIF
    const originalAvifPath = path.join(outputDir, `${filename}.avif`)
    await image.avif({ quality: QUALITY.avif }).toFile(originalAvifPath)

    console.log(`✅ Optimized ${filename}${ext}`)
  } catch (error) {
    console.error(`❌ Error optimizing ${filename}${ext}:`, error.message)
  }
}

async function optimizeAllImages() {
  console.log("🖼️  Starting image optimization...")

  const files = fs.readdirSync(IMAGE_DIR)
  const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))

  if (imageFiles.length === 0) {
    console.log("No images found to optimize")
    return
  }

  console.log(`Found ${imageFiles.length} images to optimize`)

  for (const file of imageFiles) {
    const inputPath = path.join(IMAGE_DIR, file)
    await optimizeImage(inputPath, OUTPUT_DIR)
  }

  console.log("🎉 Image optimization complete!")
  console.log(`Optimized images saved to: ${OUTPUT_DIR}`)
}

// Run optimization
optimizeAllImages().catch(console.error)
