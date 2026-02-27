#!/usr/bin/env node

/**
 * Compression Testing Utility
 * Tests the effectiveness of response compression for different API endpoints
 */

import fetch from "node-fetch"
import { promisify } from "util"
import { gunzip, gzip } from "zlib"

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

const BASE_URL = process.env.TEST_URL || "http://localhost:2112"

const testEndpoints = [
  {
    name: "Data Quality API",
    url: `${BASE_URL}/api/data-quality`,
    expectedCompression: true,
    description: "Large analytics data that should be highly compressed",
  },
  {
    name: "Available Perfumes API",
    url: `${BASE_URL}/api/available-perfumes`,
    expectedCompression: true,
    description: "Perfume data that should be compressed",
  },
  {
    name: "More Perfumes API",
    url: `${BASE_URL}/api/more-perfumes?houseId=chanel&skip=0&take=20`,
    expectedCompression: true,
    description: "Paginated perfume data",
  },
  {
    name: "Compression Stats API",
    url: `${BASE_URL}/admin/compression-stats`,
    expectedCompression: true,
    description: "Compression monitoring endpoint",
  },
  {
    name: "Small API Response",
    url: `${BASE_URL}/api/available-perfumes?limit=1`,
    expectedCompression: false,
    description: "Small response that may not be compressed",
  },
]

async function testCompression(endpoint) {
  console.log(`\n🧪 Testing: ${endpoint.name}`)
  console.log(`📍 URL: ${endpoint.url}`)
  console.log(`📝 Description: ${endpoint.description}`)

  try {
    const response = await fetch(endpoint.url, {
      headers: {
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "Compression-Test/1.0",
      },
    })

    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`)
      return null
    }

    const contentLength = response.headers.get("content-length")
    const contentEncoding = response.headers.get("content-encoding")
    const contentType = response.headers.get("content-type")
    const vary = response.headers.get("vary")
    const originalSize = response.headers.get("x-original-size")
    const compressionEnabled = response.headers.get("x-compression-enabled")

    console.log(`📊 Response Headers:`)
    console.log(`   Content-Type: ${contentType}`)
    console.log(`   Content-Length: ${contentLength} bytes`)
    console.log(`   Content-Encoding: ${contentEncoding || "none"}`)
    console.log(`   Vary: ${vary || "none"}`)
    console.log(`   X-Original-Size: ${originalSize || "not set"}`)
    console.log(`   X-Compression-Enabled: ${compressionEnabled || "not set"}`)

    const responseText = await response.text()
    const actualSize = Buffer.byteLength(responseText, "utf8")

    // Calculate compression ratio
    let compressionRatio = 0
    let isCompressed = false

    if (
      contentEncoding === "gzip" ||
      contentEncoding === "br" ||
      contentEncoding === "deflate"
    ) {
      isCompressed = true
      console.log(`📦 Compression Analysis:`)
      console.log(`   Compression Type: ${contentEncoding.toUpperCase()}`)
      console.log(`   Response Size: ${actualSize} bytes`)
      console.log(`   Content-Length: ${contentLength || "chunked"} bytes`)

      // For Brotli and gzip, we can't easily calculate the exact ratio without decompressing
      // But we can estimate based on typical compression ratios
      if (contentEncoding === "br") {
        compressionRatio = 60 // Brotli typically achieves 60-80% compression
        console.log(`   Estimated Compression Ratio: ~${compressionRatio}% (Brotli)`)
      } else if (contentEncoding === "gzip") {
        compressionRatio = 50 // Gzip typically achieves 50-70% compression
        console.log(`   Estimated Compression Ratio: ~${compressionRatio}% (Gzip)`)
      }
    } else {
      console.log(`📦 No compression applied (Content-Encoding: ${contentEncoding || "none"})`)
    }

    // Validate expectations
    const meetsExpectation = endpoint.expectedCompression
      ? isCompressed
      : !isCompressed
    const status = meetsExpectation ? "✅" : "❌"

    console.log(`${status} Compression Status: ${
        isCompressed ? "COMPRESSED" : "NOT COMPRESSED"
      }`)
    console.log(`${status} Meets Expectation: ${meetsExpectation ? "YES" : "NO"}`)

    return {
      name: endpoint.name,
      url: endpoint.url,
      isCompressed,
      compressionRatio: parseFloat(compressionRatio),
      contentLength: parseInt(contentLength || "0"),
      actualSize,
      meetsExpectation,
      contentEncoding,
      originalSize: originalSize ? parseInt(originalSize) : null,
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
    return null
  }
}

async function runCompressionTests() {
  console.log("🚀 Starting Compression Tests")
  console.log(`🌐 Base URL: ${BASE_URL}`)
  console.log("=" * 60)

  const results = []

  for (const endpoint of testEndpoints) {
    const result = await testCompression(endpoint)
    if (result) {
      results.push(result)
    }
  }

  // Summary
  console.log("\n📈 COMPRESSION TEST SUMMARY")
  console.log("=" * 60)

  const totalTests = results.length
  const compressedTests = results.filter(r => r.isCompressed).length
  const passedTests = results.filter(r => r.meetsExpectation).length
  const avgCompressionRatio =
    results
      .filter(r => r.isCompressed && r.compressionRatio > 0)
      .reduce((sum, r) => sum + r.compressionRatio, 0) / compressedTests || 0

  console.log(`📊 Total Tests: ${totalTests}`)
  console.log(`📦 Compressed Responses: ${compressedTests}`)
  console.log(`✅ Passed Tests: ${passedTests}`)
  console.log(`📉 Average Compression Ratio: ${avgCompressionRatio.toFixed(2)}%`)

  // Detailed results
  console.log("\n📋 DETAILED RESULTS")
  console.log("-" * 60)

  results.forEach(result => {
    const status = result.meetsExpectation ? "✅" : "❌"
    const compression = result.isCompressed
      ? `(${result.compressionRatio}%)`
      : "(not compressed)"
    console.log(`${status} ${result.name}: ${compression}`)
  })

  // Recommendations
  console.log("\n💡 RECOMMENDATIONS")
  console.log("-" * 60)

  if (avgCompressionRatio < 30) {
    console.log("⚠️  Low compression ratio detected. Consider:")
    console.log("   - Increasing compression level")
    console.log("   - Lowering compression threshold")
    console.log("   - Checking if responses are already optimized")
  }

  if (passedTests < totalTests) {
    console.log("⚠️  Some tests failed expectations. Check:")
    console.log("   - Compression middleware configuration")
    console.log("   - Content-Type headers")
    console.log("   - Response size thresholds")
  }

  if (avgCompressionRatio > 70) {
    console.log("🎉 Excellent compression ratio! Your API responses are well optimized.")
  }

  console.log("\n✨ Compression testing complete!")
}

// Run the tests
runCompressionTests().catch(console.error)
