import { describe, expect, it } from "vitest"

import {
  type DataQualityStats,
  getMissingHouseInfoBreakdown,
  prepareAllChartData,
  prepareDuplicateChartData,
  prepareMissingChartData,
  prepareMissingHouseInfoChartData,
  prepareTrendChartData,
} from "./chartDataUtils"

const mockStats: DataQualityStats = {
  totalMissing: 100,
  totalDuplicates: 50,
  missingByBrand: {
    "Brand A": 30,
    "Brand B": 25,
    "Brand C": 20,
    "Brand D": 15,
    "Brand E": 10,
  },
  duplicatesByBrand: {
    "Brand X": 20,
    "Brand Y": 15,
    "Brand Z": 10,
  },
  totalMissingHouseInfo: 10,
  missingHouseInfoByBrand: {
    "House A": 5,
    "House B": 3,
    "House C": 2,
  },
  lastUpdated: "2024-01-01",
  historyData: {
    dates: ["2024-01-01", "2024-01-02", "2024-01-03"],
    missing: [100, 95, 90],
    duplicates: [50, 48, 45],
  },
}

describe("chartDataUtils", () => {
  describe("getMissingHouseInfoBreakdown", () => {
    it("should return empty object when stats is null", () => {
      const result = getMissingHouseInfoBreakdown(null)
      expect(result).toEqual({})
    })

    it("should return empty object when missingHouseInfoByBrand is undefined", () => {
      const stats = { ...mockStats, missingHouseInfoByBrand: undefined }
      const result = getMissingHouseInfoBreakdown(stats)
      expect(result).toEqual({})
    })

    it("should return breakdown with field missing arrays", () => {
      const result = getMissingHouseInfoBreakdown(mockStats)
      expect(result).toEqual({
        "House A": [
          "Field missing",
          "Field missing",
          "Field missing",
          "Field missing",
          "Field missing",
        ],
        "House B": ["Field missing", "Field missing", "Field missing"],
        "House C": ["Field missing", "Field missing"],
      })
    })
  })

  describe("prepareMissingChartData", () => {
    it("should return empty arrays when stats is null", () => {
      const result = prepareMissingChartData(null)
      expect(result.labels).toEqual([])
      expect(result.datasets[0].data).toEqual([])
    })

    it("should prepare chart data from stats", () => {
      const result = prepareMissingChartData(mockStats)
      expect(result.labels).toEqual([
        "Brand A",
        "Brand B",
        "Brand C",
        "Brand D",
        "Brand E",
      ])
      expect(result.datasets[0].data).toEqual([
30, 25, 20, 15, 10
])
      expect(result.datasets[0].label).toBe("Missing Information")
    })

    it("should limit to top 10 brands", () => {
      const statsWithManyBrands = {
        ...mockStats,
        missingByBrand: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`Brand ${i}`, 100 - i])),
      }
      const result = prepareMissingChartData(statsWithManyBrands)
      expect(result.labels.length).toBe(10)
      expect(result.datasets[0].data.length).toBe(10)
    })
  })

  describe("prepareDuplicateChartData", () => {
    it("should return empty arrays when stats is null", () => {
      const result = prepareDuplicateChartData(null)
      expect(result.labels).toEqual([])
      expect(result.datasets[0].data).toEqual([])
    })

    it("should prepare chart data from stats", () => {
      const result = prepareDuplicateChartData(mockStats)
      expect(result.labels).toEqual(["Brand X", "Brand Y", "Brand Z"])
      expect(result.datasets[0].data).toEqual([20, 15, 10])
      expect(result.datasets[0].label).toBe("Duplicate Entries")
    })
  })

  describe("prepareMissingHouseInfoChartData", () => {
    it("should return empty arrays when stats is null", () => {
      const result = prepareMissingHouseInfoChartData(null)
      expect(result.labels).toEqual([])
      expect(result.datasets[0].data).toEqual([])
    })

    it("should prepare chart data from stats", () => {
      const result = prepareMissingHouseInfoChartData(mockStats)
      expect(result.labels).toEqual(["House A", "House B", "House C"])
      expect(result.datasets[0].data).toEqual([5, 3, 2])
      expect(result.datasets[0].label).toBe("Missing House Info")
    })
  })

  describe("prepareTrendChartData", () => {
    it("should return empty arrays when stats is null", () => {
      const result = prepareTrendChartData(null)
      expect(result.labels).toEqual([])
      expect(result.datasets).toEqual([])
    })

    it("should return empty arrays when historyData is undefined", () => {
      const stats = { ...mockStats, historyData: undefined }
      const result = prepareTrendChartData(stats)
      expect(result.labels).toEqual([])
      expect(result.datasets).toEqual([])
    })

    it("should prepare trend chart data from stats", () => {
      const result = prepareTrendChartData(mockStats)
      expect(result.labels).toEqual(["2024-01-01", "2024-01-02", "2024-01-03"])
      expect(result.datasets).toHaveLength(2)
      expect(result.datasets[0].label).toBe("Missing Information")
      expect(result.datasets[0].data).toEqual([100, 95, 90])
      expect(result.datasets[1].label).toBe("Duplicate Entries")
      expect(result.datasets[1].data).toEqual([50, 48, 45])
    })
  })

  describe("prepareAllChartData", () => {
    it("should prepare all chart data at once", () => {
      const result = prepareAllChartData(mockStats)
      expect(result).toHaveProperty("missingChartData")
      expect(result).toHaveProperty("duplicateChartData")
      expect(result).toHaveProperty("missingHouseInfoChartData")
      expect(result).toHaveProperty("trendChartData")
      expect(result).toHaveProperty("missingHouseInfoBreakdown")
    })

    it("should handle null stats gracefully", () => {
      const result = prepareAllChartData(null)
      expect(result.missingChartData.labels).toEqual([])
      expect(result.duplicateChartData.labels).toEqual([])
      expect(result.trendChartData.labels).toEqual([])
      expect(result.missingHouseInfoBreakdown).toEqual({})
    })
  })
})




