import { type Dispatch, type SetStateAction } from "react"

interface TimeframeSelectorProps {
  timeframe: "week" | "month" | "all"
  setTimeframe: Dispatch<SetStateAction<"week" | "month" | "all">>
  isFetching?: boolean
  timePeriodLabel: string
  refreshingLabel: string
  lastWeekLabel: string
  lastMonthLabel: string
  allTimeLabel: string
}

const TimeframeSelector = ({
  timeframe,
  setTimeframe,
  isFetching = false,
  timePeriodLabel,
  refreshingLabel,
  lastWeekLabel,
  lastMonthLabel,
  allTimeLabel,
}: TimeframeSelectorProps) => (
  <div className="mb-6">
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <h3 className="text-lg font-medium text-gray-900">{timePeriodLabel}</h3>
      {isFetching && (
        <span className="text-sm text-gray-500" aria-live="polite">
          {refreshingLabel}
        </span>
      )}
    </div>
    <div className="flex space-x-2">
      <button
        type="button"
        onClick={() => setTimeframe("week")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          timeframe === "week"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        {lastWeekLabel}
      </button>
      <button
        type="button"
        onClick={() => setTimeframe("month")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          timeframe === "month"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        {lastMonthLabel}
      </button>
      <button
        type="button"
        onClick={() => setTimeframe("all")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          timeframe === "all"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        {allTimeLabel}
      </button>
    </div>
  </div>
)

export default TimeframeSelector
