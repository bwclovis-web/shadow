#!/usr/bin/env node

/**
 * Bundle analysis script
 * Analyzes the built bundle and provides optimization recommendations
 */

import { existsSync, readdirSync, statSync } from "fs"
import { join, dirname, extname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUILD_DIR = join(__dirname, "../build")
const STATS_FILE = join(__dirname, "../dist/stats.html")

// Bundle size limits (in KB)
const LIMITS = {
  initial: 250,
  route: 100,
  vendor: 200,
  component: 50,
  warning: 1000,
}

function analyzeBundle() {
  console.log("📊 Analyzing bundle...")

  if (!existsSync(BUILD_DIR)) {
    console.error("❌ Build directory not found. Run build first.")
    process.exit(1)
  }

  const assets = []
  const jsFiles = []
  const cssFiles = []
  const imageFiles = []

  // Scan dist directory for assets
  function scanDirectory(dir, relativePath = "") {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const relativeItemPath = join(relativePath, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        scanDirectory(fullPath, relativeItemPath)
      } else {
        const size = stat.size
        const ext = extname(item).toLowerCase()

        const asset = {
          name: relativeItemPath,
          size: size,
          sizeKB: Math.round((size / 1024) * 100) / 100,
          type: getAssetType(ext),
        }

        assets.push(asset)

        if (ext === ".js") {
          jsFiles.push(asset)
        } else if (ext === ".css") {
          cssFiles.push(asset)
        } else if (
          [
".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"
].includes(ext)
        ) {
          imageFiles.push(asset)
        }
      }
    }
  }

  scanDirectory(BUILD_DIR)

  // Analyze JavaScript bundles
  const jsAnalysis = analyzeJavaScriptBundles(jsFiles)

  // Analyze CSS bundles
  const cssAnalysis = analyzeCSSBundles(cssFiles)

  // Analyze images
  const imageAnalysis = analyzeImages(imageFiles)

  // Generate report
  generateReport({
    js: jsAnalysis,
    css: cssAnalysis,
    images: imageAnalysis,
    total: {
      files: assets.length,
      size: assets.reduce((sum, asset) => sum + asset.size, 0),
      sizeKB:
        Math.round((assets.reduce((sum, asset) => sum + asset.size, 0) / 1024) * 100) / 100,
    },
  })
}

function getAssetType(ext) {
  const types = {
    ".js": "JavaScript",
    ".css": "CSS",
    ".html": "HTML",
    ".png": "Image",
    ".jpg": "Image",
    ".jpeg": "Image",
    ".webp": "Image",
    ".svg": "Image",
    ".gif": "Image",
    ".woff": "Font",
    ".woff2": "Font",
    ".ttf": "Font",
    ".eot": "Font",
  }
  return types[ext] || "Other"
}

function analyzeJavaScriptBundles(jsFiles) {
  const analysis = {
    total: jsFiles.length,
    totalSize: jsFiles.reduce((sum, file) => sum + file.size, 0),
    chunks: {},
    recommendations: [],
  }

  // Group files by type
  jsFiles.forEach(file => {
    const name = file.name
    let type = "other"

    if (name.includes("vendor")) {
      type = "vendor"
    } else if (name.includes("admin")) {
      type = "admin"
    } else if (name.includes("auth")) {
      type = "auth"
    } else if (name.includes("main") || name.includes("index")) {
      type = "main"
    } else if (name.includes("chunk")) {
      type = "chunk"
    }

    if (!analysis.chunks[type]) {
      analysis.chunks[type] = []
    }
    analysis.chunks[type].push(file)
  })

  // Calculate sizes by type
  Object.keys(analysis.chunks).forEach(type => {
    const files = analysis.chunks[type]
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    analysis.chunks[type] = {
      files: files,
      count: files.length,
      totalSize: totalSize,
      totalSizeKB: Math.round((totalSize / 1024) * 100) / 100,
    }
  })

  // Generate recommendations
  if (analysis.chunks.main && analysis.chunks.main.totalSizeKB > LIMITS.initial) {
    analysis.recommendations.push({
      type: "warning",
      message: `Main bundle (${analysis.chunks.main.totalSizeKB}KB) exceeds recommended size (${LIMITS.initial}KB). Consider code splitting.`,
    })
  }

  if (analysis.chunks.vendor && analysis.chunks.vendor.totalSizeKB > LIMITS.vendor) {
    analysis.recommendations.push({
      type: "warning",
      message: `Vendor bundle (${analysis.chunks.vendor.totalSizeKB}KB) exceeds recommended size (${LIMITS.vendor}KB). Consider splitting vendor libraries.`,
    })
  }

  const largeFiles = jsFiles.filter(file => file.sizeKB > LIMITS.component)
  if (largeFiles.length > 0) {
    analysis.recommendations.push({
      type: "info",
      message: `${largeFiles.length} JavaScript files exceed ${LIMITS.component}KB. Consider lazy loading.`,
    })
  }

  return analysis
}

function analyzeCSSBundles(cssFiles) {
  const analysis = {
    total: cssFiles.length,
    totalSize: cssFiles.reduce((sum, file) => sum + file.size, 0),
    totalSizeKB:
      Math.round((cssFiles.reduce((sum, file) => sum + file.size, 0) / 1024) * 100) /
      100,
  }

  return analysis
}

function analyzeImages(imageFiles) {
  const analysis = {
    total: imageFiles.length,
    totalSize: imageFiles.reduce((sum, file) => sum + file.size, 0),
    totalSizeKB:
      Math.round((imageFiles.reduce((sum, file) => sum + file.size, 0) / 1024) * 100) / 100,
    byFormat: {},
    largeImages: [],
  }

  // Group by format
  imageFiles.forEach(file => {
    const ext = extname(file.name).toLowerCase()
    if (!analysis.byFormat[ext]) {
      analysis.byFormat[ext] = { count: 0, size: 0 }
    }
    analysis.byFormat[ext].count++
    analysis.byFormat[ext].size += file.size
  })

  // Find large images
  analysis.largeImages = imageFiles.filter(file => file.sizeKB > 100)

  return analysis
}

function generateReport(analysis) {
  console.log("\n📈 Bundle Analysis Report")
  console.log("=".repeat(50))

  // Total summary
  console.log(`\n📦 Total Assets: ${analysis.total.files} files (${analysis.total.sizeKB}KB)`)

  // JavaScript analysis
  console.log("\n🔧 JavaScript Bundles:")
  console.log(`   Total: ${analysis.js.total} files (${
      Math.round((analysis.js.totalSize / 1024) * 100) / 100
    }KB)`)

  Object.keys(analysis.js.chunks).forEach(type => {
    const chunk = analysis.js.chunks[type]
    console.log(`   ${type.toUpperCase()}: ${chunk.count} files (${chunk.totalSizeKB}KB)`)
  })

  // CSS analysis
  console.log("\n🎨 CSS Bundles:")
  console.log(`   Total: ${analysis.css.total} files (${analysis.css.totalSizeKB}KB)`)

  // Images analysis
  console.log("\n🖼️  Images:")
  console.log(`   Total: ${analysis.images.total} files (${analysis.images.totalSizeKB}KB)`)

  if (Object.keys(analysis.images.byFormat).length > 0) {
    console.log("   By format:")
    Object.keys(analysis.images.byFormat).forEach(format => {
      const formatData = analysis.images.byFormat[format]
      console.log(`     ${format}: ${formatData.count} files (${
          Math.round((formatData.size / 1024) * 100) / 100
        }KB)`)
    })
  }

  if (analysis.images.largeImages.length > 0) {
    console.log(`   Large images (>100KB): ${analysis.images.largeImages.length}`)
  }

  // Recommendations
  if (analysis.js.recommendations.length > 0) {
    console.log("\n💡 Recommendations:")
    analysis.js.recommendations.forEach((rec, index) => {
      const icon = rec.type === "warning" ? "⚠️" : "ℹ️"
      console.log(`   ${index + 1}. ${icon} ${rec.message}`)
    })
  }

  // Bundle splitting suggestions
  console.log("\n🚀 Bundle Splitting Suggestions:")
  console.log("   1. Use React.lazy() for route-based code splitting")
  console.log("   2. Split vendor libraries into separate chunks")
  console.log("   3. Implement dynamic imports for heavy components")
  console.log("   4. Use webpack-bundle-analyzer for detailed analysis")

  console.log("\n✅ Analysis complete!")

  if (existsSync(STATS_FILE)) {
    console.log(`\n📊 Detailed visualization available at: ${STATS_FILE}`)
  }
}

// Run analysis
analyzeBundle()
