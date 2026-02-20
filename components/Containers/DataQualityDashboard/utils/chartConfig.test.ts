import { describe, expect, it } from "vitest"

import { createChartConfig } from "./chartConfig"

describe("chartConfig", () => {
  describe("createChartConfig", () => {
    it("should create chart configuration object", () => {
      const config = createChartConfig()

      expect(config).toHaveProperty("responsive")
      expect(config.responsive).toBe(true)
    })

    it("should have plugins configuration", () => {
      const config = createChartConfig()

      expect(config).toHaveProperty("plugins")
      expect(config.plugins).toHaveProperty("legend")
      expect(config.plugins).toHaveProperty("title")
    })

    it("should set legend position to top", () => {
      const config = createChartConfig()

      expect(config.plugins.legend.position).toBe("top")
    })

    it("should display title", () => {
      const config = createChartConfig()

      expect(config.plugins.title.display).toBe(true)
      expect(config.plugins.title.text).toBe("Data Quality Metrics")
    })

    it("should return a new object on each call", () => {
      const config1 = createChartConfig()
      const config2 = createChartConfig()

      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)
    })
  })
})
