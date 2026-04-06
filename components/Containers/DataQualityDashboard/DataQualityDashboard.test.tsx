import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    if (key === "noData") return "No data available."
    return key
  },
}))

import DataQualityDashboard from "./DataQualityDashboardRefactored"

vi.mock("./components/AdminCSVControls", () => ({
  default: ({ onUploadComplete }: { onUploadComplete: () => void }) => (
    <div data-testid="admin-csv-controls">
      <button type="button" onClick={onUploadComplete}>
        Upload Complete
      </button>
    </div>
  ),
}))

vi.mock("./components/DashboardContent", () => ({
  default: ({
    stats,
    timeframe,
    setTimeframe,
  }: {
    stats: Record<string, unknown>
    timeframe: string
    setTimeframe: (v: string) => void
  }) => (
    <div data-testid="dashboard-content">
      <div>Stats: {JSON.stringify(stats)}</div>
      <div>Timeframe: {timeframe}</div>
      <button type="button" onClick={() => setTimeframe("week")}>
        Set Week
      </button>
    </div>
  ),
}))

vi.mock("./components/ChartVisualizations", () => ({
  default: () => <div>Chart Visualizations</div>,
}))

vi.mock("./components/TrendChart", () => ({
  default: () => <div>Trend Chart</div>,
}))

vi.mock("./components/ErrorDisplay", () => ({
  default: ({ message }: { message: string }) => (
    <div data-testid="error-display">{message}</div>
  ),
}))

vi.mock("./components/LoadingIndicator", () => ({
  default: () => <div data-testid="loading-indicator">Loading...</div>,
}))

const mockForceRefresh = vi.fn()
vi.mock("./hooks", () => ({
  useFetchDataQualityStats: vi.fn(),
}))

import { useFetchDataQualityStats } from "./hooks"

const mockUseFetchDataQualityStats = useFetchDataQualityStats as unknown as ReturnType<typeof vi.fn>

describe("DataQualityDashboard", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render loading indicator on initial load", () => {
    mockUseFetchDataQualityStats.mockReturnValue({
      stats: null,
      isInitialLoad: true,
      isFetching: true,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    render(<DataQualityDashboard />)

    expect(screen.getByTestId("loading-indicator")).toBeInTheDocument()
    expect(screen.queryByTestId("dashboard-content")).not.toBeInTheDocument()
  })

  it("should render error display when there is an error", () => {
    const errorMessage = "Failed to fetch data"
    mockUseFetchDataQualityStats.mockReturnValue({
      stats: null,
      isInitialLoad: false,
      isFetching: false,
      error: errorMessage,
      forceRefresh: mockForceRefresh,
    })

    render(<DataQualityDashboard />)

    expect(screen.getByTestId("error-display")).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
    expect(screen.queryByTestId("dashboard-content")).not.toBeInTheDocument()
  })

  it('should render "No data available" when stats is null after load', () => {
    mockUseFetchDataQualityStats.mockReturnValue({
      stats: null,
      isInitialLoad: false,
      isFetching: false,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    render(<DataQualityDashboard />)

    expect(screen.getByText("No data available.")).toBeInTheDocument()
    expect(screen.queryByTestId("dashboard-content")).not.toBeInTheDocument()
  })

  it("should render dashboard content with valid stats", () => {
    const mockStats = {
      totalMissing: 10,
      totalDuplicates: 5,
      missingByBrand: { "Brand A": 5 },
      duplicatesByBrand: { "Brand B": 3 },
      lastUpdated: "2024-01-01",
    }

    mockUseFetchDataQualityStats.mockReturnValue({
      stats: mockStats,
      isInitialLoad: false,
      isFetching: false,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    render(<DataQualityDashboard />)

    expect(screen.getByTestId("dashboard-content")).toBeInTheDocument()
    expect(screen.getByText(/Stats:/)).toBeInTheDocument()
  })

  it("should render admin controls when isAdmin is true", () => {
    const mockStats = {
      totalMissing: 10,
      totalDuplicates: 5,
      missingByBrand: {},
      duplicatesByBrand: {},
      lastUpdated: "2024-01-01",
    }

    mockUseFetchDataQualityStats.mockReturnValue({
      stats: mockStats,
      isInitialLoad: false,
      isFetching: false,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    render(<DataQualityDashboard isAdmin />)

    expect(screen.getByTestId("admin-csv-controls")).toBeInTheDocument()
  })

  it("should not render admin controls when isAdmin is false", () => {
    const mockStats = {
      totalMissing: 10,
      totalDuplicates: 5,
      missingByBrand: {},
      duplicatesByBrand: {},
      lastUpdated: "2024-01-01",
    }

    mockUseFetchDataQualityStats.mockReturnValue({
      stats: mockStats,
      isInitialLoad: false,
      isFetching: false,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    render(<DataQualityDashboard isAdmin={false} />)

    expect(screen.queryByTestId("admin-csv-controls")).not.toBeInTheDocument()
  })

  it("should call forceRefresh when upload is complete", async () => {
    const mockStats = {
      totalMissing: 10,
      totalDuplicates: 5,
      missingByBrand: {},
      duplicatesByBrand: {},
      lastUpdated: "2024-01-01",
    }

    mockUseFetchDataQualityStats.mockReturnValue({
      stats: mockStats,
      isInitialLoad: false,
      isFetching: false,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    const { container } = render(<DataQualityDashboard isAdmin />)

    const uploadBtn = container.querySelector('[data-testid="admin-csv-controls"] button')
    expect(uploadBtn).toBeTruthy()
    uploadBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }))

    await waitFor(() => {
      expect(mockForceRefresh).toHaveBeenCalledWith(true)
    })
  })

  it("should use month timeframe by default", () => {
    const mockStats = {
      totalMissing: 10,
      totalDuplicates: 5,
      missingByBrand: {},
      duplicatesByBrand: {},
      lastUpdated: "2024-01-01",
    }

    mockUseFetchDataQualityStats.mockReturnValue({
      stats: mockStats,
      isInitialLoad: false,
      isFetching: false,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    const { container } = render(<DataQualityDashboard />)

    expect(container.textContent).toContain("Timeframe: month")
  })

  it("keeps dashboard visible during background refetch", () => {
    const mockStats = {
      totalMissing: 10,
      totalDuplicates: 5,
      missingByBrand: {},
      duplicatesByBrand: {},
      lastUpdated: "2024-01-01",
    }

    mockUseFetchDataQualityStats.mockReturnValue({
      stats: mockStats,
      isInitialLoad: false,
      isFetching: true,
      error: null,
      forceRefresh: mockForceRefresh,
    })

    render(<DataQualityDashboard />)

    expect(screen.queryByTestId("loading-indicator")).not.toBeInTheDocument()
    expect(screen.getByTestId("dashboard-content")).toBeInTheDocument()
  })
})
