#!/usr/bin/env node

/**
 * Data Quality Report Generator
 *
 * This script analyzes the database and generates reports about:
 * - Missing information in perfume records
 * - Duplicate records
 * - Data quality trends over time
 *
 * Reports are saved to docs/reports/ directory
 */

import { PrismaClient } from "@prisma/client"
import { exec } from "child_process"
import * as fs from "fs/promises"
import * as path from "path"
import { fileURLToPath } from "url"
import { promisify } from "util"

const execAsync = promisify(exec)
const prisma = new PrismaClient()

// Get the current module's directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")

// Ensure reports directory exists
const ensureReportsDir = async () => {
  const reportsDir = path.resolve(projectRoot, "docs", "reports")
  try {
    await fs.access(reportsDir)
  } catch {
    await fs.mkdir(reportsDir, { recursive: true })
  }
  return reportsDir
}

// Generate timestamp for file naming
const generateTimestamp = () => new Date().toISOString().replace(/[:.]/g, "-")

// Analyze missing data in perfume records
const analyzeMissingData = async () => {
  try {
    // Query all perfumes from the database
    const perfumes = await prisma.perfume.findMany({
      include: {
        perfumeHouse: true,
      },
    })

    const missingDataRecords = []

    // Check each perfume for missing fields
    perfumes.forEach(perfume => {
      const missingFields = []

      if (!perfume.description || perfume.description.trim() === "") {
        missingFields.push("description")
      }
      if (!perfume.image || perfume.image.trim() === "") {
        missingFields.push("image")
      }
      if (!perfume.perfumeHouseId) {
        missingFields.push("perfumeHouse")
      }

      // Only add to report if there are missing fields
      if (missingFields.length > 0) {
        missingDataRecords.push({
          id: perfume.id,
          name: perfume.name,
          brand: perfume.perfumeHouse?.name || "Unknown",
          missingFields,
          timestamp: new Date().toISOString(),
        })
      }
    })

    return missingDataRecords
  } catch (error) {
    console.error("Error analyzing missing data:", error)
    return []
  }
}

// Analyze duplicate records
const analyzeDuplicates = async () => {
  try {
    // Query for duplicate perfume names
    const perfumes = await prisma.perfume.findMany({
      select: {
        name: true,
        perfumeHouse: {
          select: {
            name: true,
          },
        },
      },
    })

    // Count occurrences of each name
    const nameCount = {}
    perfumes.forEach(perfume => {
      const key = perfume.name.toLowerCase().trim()
      if (!nameCount[key]) {
        nameCount[key] = []
      }
      nameCount[key].push({
        name: perfume.name,
        brand: perfume.perfumeHouse?.name || "Unknown",
      })
    })

    // Find duplicates
    const duplicates = []
    Object.entries(nameCount).forEach(([name, instances]) => {
      if (instances.length > 1) {
        duplicates.push({
          name,
          count: instances.length,
          instances,
        })
      }
    })

    return duplicates
  } catch (error) {
    console.error("Error analyzing duplicates:", error)
    return []
  }
}

// Analyze houses with no perfumes
const analyzeHousesWithNoPerfumes = async () => {
  try {
    // Query all houses with perfume count
    const houses = await prisma.perfumeHouse.findMany({
      include: {
        _count: {
          select: { perfumes: true },
        },
      },
    })

    // Filter houses with no perfumes
    const housesWithNoPerfumes = houses
      .filter(house => house._count.perfumes === 0)
      .map(house => ({
        id: house.id,
        name: house.name,
        type: house.type,
        createdAt: house.createdAt,
      }))

    return housesWithNoPerfumes
  } catch (error) {
    console.error("Error analyzing houses with no perfumes:", error)
    return []
  }
}

// Save report data to files
const saveReports = async (
  reportsDir,
  timestamp,
  missingData,
  duplicates,
  housesWithNoPerfumes
) => {
  try {
    // Save missing data report as JSON
    if (missingData) {
      const missingJsonPath = path.join(reportsDir, `missing_info_${timestamp}.json`)
      await fs.writeFile(missingJsonPath, JSON.stringify(missingData, null, 2))

      // Create CSV format
      const csvRows = ["ID,Name,Brand,Missing Fields"]
      missingData.forEach(record => {
        const fields = record.missingFields.join("; ")
        csvRows.push(`${record.id},${record.name},${record.brand},"${fields}"`)
      })
      const missingCsvPath = path.join(reportsDir, `missing_info_${timestamp}.csv`)
      await fs.writeFile(missingCsvPath, csvRows.join("\n"))

      // Create Markdown format
      let mdContent = `# Missing Information Report\n\nGenerated: ${new Date().toLocaleString()}\n\nTotal perfumes with missing info: ${
        missingData.length
      }\n\n`
      mdContent += "## By Brand\n\n"

      // Group by brand
      const byBrand = {}
      missingData.forEach(record => {
        if (!byBrand[record.brand]) {
          byBrand[record.brand] = []
        }
        byBrand[record.brand].push(record)
      })

      Object.entries(byBrand).forEach(([brand, records]) => {
        mdContent += `### ${brand} (${records.length})\n\n`
        records.forEach(record => {
          mdContent += `- **${record.name}**: Missing ${record.missingFields.join(", ")}\n`
        })
        mdContent += "\n"
      })

      const missingMdPath = path.join(reportsDir, `missing_info_${timestamp}.md`)
      await fs.writeFile(missingMdPath, mdContent)
    }

    // Save duplicates report
    if (duplicates) {
      const duplicatesPath = path.join(reportsDir, `duplicates_${timestamp}.md`)
      let mdContent = `# Duplicates Report\n\nGenerated: ${new Date().toLocaleString()}\n\n`
      mdContent += `Total perfumes with duplicate entries: **${duplicates.length}**\n\n`

      if (duplicates.length > 0) {
        mdContent += "## File Breakdown\n\n"
        mdContent += "| CSV File | Duplicates |\n"
        mdContent += "|----------|------------|\n"

        // Group duplicates by brand
        const byBrand = {}
        duplicates.forEach(dup => {
          dup.instances.forEach(instance => {
            const brand = instance.brand.toLowerCase().replace(/\s+/g, "_")
            byBrand[brand] = (byBrand[brand] || 0) + 1
          })
        })

        Object.entries(byBrand).forEach(([brand, count]) => {
          mdContent += `| perfumes_${brand}.csv | ${count} |\n`
        })

        mdContent += "\n## Duplicates List\n\n"
        duplicates.forEach(dup => {
          mdContent += `### ${dup.name} (${dup.count} instances)\n\n`
          dup.instances.forEach(instance => {
            mdContent += `- ${instance.name} (${instance.brand})\n`
          })
          mdContent += "\n"
        })
      }

      await fs.writeFile(duplicatesPath, mdContent)
    }

    // Save houses with no perfumes report
    if (housesWithNoPerfumes) {
      const housesPath = path.join(
        reportsDir,
        `houses_no_perfumes_${timestamp}.json`
      )
      await fs.writeFile(housesPath, JSON.stringify(housesWithNoPerfumes, null, 2))

      // Create Markdown format
      let mdContent = `# Houses With No Perfumes Report\n\nGenerated: ${new Date().toLocaleString()}\n\n`
      mdContent += `Total houses with no perfumes: **${housesWithNoPerfumes.length}**\n\n`

      if (housesWithNoPerfumes.length > 0) {
        mdContent += "## List of Houses\n\n"
        mdContent += "| Name | Type | Created At |\n"
        mdContent += "|------|------|------------|\n"

        housesWithNoPerfumes.forEach(house => {
          const createdAt = new Date(house.createdAt).toLocaleDateString()
          mdContent += `| ${house.name} | ${house.type} | ${createdAt} |\n`
        })
      }

      const housesMdPath = path.join(
        reportsDir,
        `houses_no_perfumes_${timestamp}.md`
      )
      await fs.writeFile(housesMdPath, mdContent)
    }

    console.log("Reports generated successfully")
    console.log(`- Missing data records: ${missingData?.length || 0}`)
    console.log(`- Duplicate records: ${duplicates?.length || 0}`)
    console.log(`- Houses with no perfumes: ${housesWithNoPerfumes?.length || 0}`)
  } catch (error) {
    console.error("Error saving reports:", error)
  }
}

// Update history file
const updateHistory = async (reportsDir, timestamp) => {
  try {
    const historyPath = path.join(reportsDir, "data_quality_history.json")
    let history = { reports: [] }

    try {
      const existingHistory = await fs.readFile(historyPath, "utf-8")
      const parsed = JSON.parse(existingHistory)
      // Ensure reports array exists
      history = {
        reports: Array.isArray(parsed?.reports) ? parsed.reports : [],
      }
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    history.reports.push({
      timestamp,
      generated: new Date().toISOString(),
    })

    // Keep only last 30 reports
    if (history.reports.length > 30) {
      history.reports = history.reports.slice(-30)
    }

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2))
  } catch (error) {
    console.error("Error updating history:", error)
  }
}

// Main execution function
const main = async () => {
  try {
    console.log("Starting data quality report generation...")

    // Ensure reports directory exists
    const reportsDir = await ensureReportsDir()

    // Generate timestamp
    const timestamp = generateTimestamp()

    // Analyze data
    console.log("Analyzing missing data...")
    const missingData = await analyzeMissingData()

    console.log("Analyzing duplicates...")
    const duplicates = await analyzeDuplicates()

    console.log("Analyzing houses with no perfumes...")
    const housesWithNoPerfumes = await analyzeHousesWithNoPerfumes()

    // Save reports
    console.log("Saving reports...")
    await saveReports(
      reportsDir,
      timestamp,
      missingData,
      duplicates,
      housesWithNoPerfumes
    )

    // Update history
    console.log("Updating history...")
    await updateHistory(reportsDir, timestamp)

    console.log("Data quality report generation completed successfully")
  } catch (error) {
    console.error("Error in main execution:", error)
    process.exit(1)
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect()
  }
}

// Run if called directly
// Cross-platform check if this module is being run directly
const isMainModule = () => {
  const scriptPath = fileURLToPath(import.meta.url)
  const execPath = process.argv[1]
  return scriptPath === execPath || scriptPath === path.resolve(execPath)
}

if (isMainModule()) {
  main()
}

export { main }
