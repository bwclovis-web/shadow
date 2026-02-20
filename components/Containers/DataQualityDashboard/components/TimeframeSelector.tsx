import { type Dispatch, type SetStateAction } from "react"

interface TimeframeSelectorProps {
  timeframe: "week" | "month" | "all"
  setTimeframe: Dispatch<SetStateAction<"week" | "month" | "all">>
}

const TimeframeSelector = ({
  timeframe,
  setTimeframe,
}:TimeframeSelectorProps) => (
  <div className="mb-6">
    <h3 className="text-lg font-medium text-gray-900 mb-3">Time Period</h3>
    <div className="flex space-x-2">
      <button
        onClick={() => setTimeframe("week")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          timeframe === "week"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        Last Week
      </button>
      <button
        onClick={() => setTimeframe("month")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          timeframe === "month"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        Last Month
      </button>
      <button
        onClick={() => setTimeframe("all")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          timeframe === "all"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        All Time
      </button>
    </div>
  </div>
)

export default TimeframeSelector
