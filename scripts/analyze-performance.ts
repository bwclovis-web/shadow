#!/usr/bin/env tsx
/**
 * Performance Analysis Script
 * 
 * Analyzes the live site for performance issues and bottlenecks.
 * Can be run locally or integrated into CI/CD pipeline.
 * 
 * Usage:
 *   tsx scripts/analyze-performance.ts [url]
 * 
 * Example:
 *   tsx scripts/analyze-performance.ts https://your-site.com
 */

import puppeteer from "puppeteer"

import type { PerformanceIssue, PerformanceMetrics, PerformanceReport } from "../app/utils/performanceAnalyzer"

interface AnalysisOptions {
  url: string
  headless?: boolean
  waitTime?: number
  output?: string
}

async function analyzePerformance(options: AnalysisOptions): Promise<PerformanceReport> {
  const { url, headless = true, waitTime = 5000 } = options

  console.log(`🔍 Analyzing performance for ${url}...`)

  const browser = await puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  try {
    const page = await browser.newPage()

    // Enable performance monitoring
    await page.setCacheEnabled(false)
    await page.setViewport({ width: 1920, height: 1080 })

    // Navigate to page
    const startTime = Date.now()
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    })

    // Wait for page to settle
    await page.waitForTimeout(waitTime)

    // Collect performance metrics
    const metrics = await page.evaluate(() => {
      const perfData: Partial<PerformanceMetrics> = {
        imageLoadTimes: [],
        scriptLoadTimes: [],
        stylesheetLoadTimes: [],
        slowRequests: [],
        componentRenderCounts: {},
        totalBytes: 0,
        totalRequests: 0,
        renderTime: 0,
      }

      // Get performance timing
      if (performance.timing) {
        const timing = performance.timing
        perfData.ttfb = timing.responseStart - timing.navigationStart
        perfData.fcp = timing.domContentLoadedEventEnd - timing.navigationStart
        perfData.renderTime = timing.loadEventEnd - timing.navigationStart
      }

      // Get resource timing
      if (performance.getEntriesByType) {
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
        
        resources.forEach(resource => {
          const duration = resource.responseEnd - resource.requestStart
          const size = resource.transferSize || 0

          perfData.totalRequests!++
          perfData.totalBytes! += size

          if (duration > 1000) {
            perfData.slowRequests!.push({
              url: resource.name,
              duration,
              size,
            })
          }

          if (resource.initiatorType === "img") {
            perfData.imageLoadTimes!.push({
              src: resource.name,
              loadTime: duration,
              size,
            })
          } else if (resource.initiatorType === "script") {
            perfData.scriptLoadTimes!.push({
              src: resource.name,
              loadTime: duration,
              size,
            })
          } else if (resource.initiatorType === "link" && resource.name.includes(".css")) {
            perfData.stylesheetLoadTimes!.push({
              src: resource.name,
              loadTime: duration,
              size,
            })
          }
        })
      }

      // Get Core Web Vitals
      const paintEntries = performance.getEntriesByType("paint") as PerformancePaintTiming[]
      paintEntries.forEach(entry => {
        if (entry.name === "first-contentful-paint") {
          perfData.fcp = entry.startTime
        }
      })

      // Get LCP
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint")
      if (lcpEntries.length > 0) {
        const lastEntry = lcpEntries[lcpEntries.length - 1] as any
        perfData.lcp = lastEntry.renderTime || lastEntry.loadTime
      }

      // Get memory usage
      if ((performance as any).memory) {
        perfData.memoryUsage = (performance as any).memory
      }

      return perfData
    })

    // Analyze issues
    const issues: PerformanceIssue[] = []

    // Core Web Vitals
    if (metrics.lcp && metrics.lcp > 2500) {
      issues.push({
        type: "error",
        category: "core-web-vitals",
        message: `LCP is ${Math.round(metrics.lcp)}ms (target: <2500ms)`,
        impact: "high",
        fix: "Optimize hero images, reduce server response time",
      })
    }

    if (metrics.fcp && metrics.fcp > 1800) {
      issues.push({
        type: "warning",
        category: "core-web-vitals",
        message: `FCP is ${Math.round(metrics.fcp)}ms (target: <1800ms)`,
        impact: "medium",
        fix: "Minimize render-blocking resources, optimize CSS",
      })
    }

    // Image issues
    const largeImages = metrics.imageLoadTimes?.filter(img => img.size > 200000) || []
    if (largeImages.length > 0) {
      issues.push({
        type: "warning",
        category: "images",
        message: `${largeImages.length} images are larger than 200KB`,
        impact: "medium",
        fix: "Compress images, use WebP/AVIF, implement responsive images",
      })
    }

    // Network issues
    if (metrics.totalBytes && metrics.totalBytes > 5000000) {
      issues.push({
        type: "warning",
        category: "network",
        message: `Total page size is ${(metrics.totalBytes / 1000000).toFixed(2)}MB`,
        impact: "medium",
        fix: "Enable compression, remove unused code, optimize assets",
      })
    }

    if (metrics.slowRequests && metrics.slowRequests.length > 5) {
      issues.push({
        type: "warning",
        category: "network",
        message: `${metrics.slowRequests.length} requests took longer than 1s`,
        impact: "medium",
        fix: "Enable HTTP/2, use CDN, optimize slow endpoints",
      })
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (issues.filter(i => i.impact === "high").length > 0) {
      recommendations.push("🚨 Address high-impact performance issues first")
    }
    if (largeImages.length > 0) {
      recommendations.push("🖼️ Optimize images using OptimizedImage component")
    }
    if (metrics.totalBytes && metrics.totalBytes > 3000000) {
      recommendations.push("📦 Reduce bundle size with code splitting")
    }

    const report: PerformanceReport = {
      timestamp: Date.now(),
      url,
      metrics: metrics as PerformanceMetrics,
      issues,
      recommendations,
    }

    return report
  } finally {
    await browser.close()
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const url = args[0] || "http://localhost:2112"

  if (!url) {
    console.error("❌ Please provide a URL to analyze")
    console.log("Usage: tsx scripts/analyze-performance.ts [url]")
    process.exit(1)
  }

  try {
    const report = await analyzePerformance({
      url,
      headless: true,
      waitTime: 5000,
    })

    console.log("\n📊 Performance Report")
    console.log("=" .repeat(50))
    console.log(`URL: ${report.url}`)
    console.log(`Timestamp: ${new Date(report.timestamp).toISOString()}`)
    console.log("\n📈 Metrics:")
    console.log(`  LCP: ${report.metrics.lcp ? Math.round(report.metrics.lcp) + "ms" : "N/A"}`)
    console.log(`  FCP: ${report.metrics.fcp ? Math.round(report.metrics.fcp) + "ms" : "N/A"}`)
    console.log(`  TTFB: ${report.metrics.ttfb ? Math.round(report.metrics.ttfb) + "ms" : "N/A"}`)
    console.log(`  Total Requests: ${report.metrics.totalRequests}`)
    console.log(`  Total Bytes: ${(report.metrics.totalBytes / 1000000).toFixed(2)}MB`)
    console.log(`  Images: ${report.metrics.imageLoadTimes.length}`)
    console.log(`  Scripts: ${report.metrics.scriptLoadTimes.length}`)

    if (report.issues.length > 0) {
      console.log("\n⚠️  Issues:")
      report.issues.forEach(issue => {
        const icon = issue.type === "error" ? "❌" : issue.type === "warning" ? "⚠️" : "ℹ️"
        console.log(`  ${icon} [${issue.category}] ${issue.message}`)
        if (issue.fix) {
          console.log(`     Fix: ${issue.fix}`)
        }
      })
    }

    if (report.recommendations.length > 0) {
      console.log("\n💡 Recommendations:")
      report.recommendations.forEach(rec => {
        console.log(`  ${rec}`)
      })
    }

    // Save to file if output path provided
    const outputPath = process.argv.find(arg => arg.startsWith("--output="))?.split("=")[1]
    if (outputPath) {
      const fs = await import("fs/promises")
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2))
      console.log(`\n💾 Report saved to ${outputPath}`)
    }

    // Exit with error code if high-impact issues found
    const hasHighImpactIssues = report.issues.some(issue => issue.impact === "high")
    if (hasHighImpactIssues) {
      console.log("\n❌ High-impact performance issues detected!")
      process.exit(1)
    } else {
      console.log("\n✅ Performance analysis complete!")
      process.exit(0)
    }
  } catch (error) {
    console.error("❌ Error analyzing performance:", error)
    process.exit(1)
  }
}

// Run when executed directly
main().catch((err) => {
  console.error(err)
  process.exit(1)
})

export { analyzePerformance }

