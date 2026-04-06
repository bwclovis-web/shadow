// Import to ensure Chart.js is registered
import "./utils/chartSetup"

import { useState } from "react"
import { useTranslations } from "next-intl"

import AdminCSVControls from "./components/AdminCSVControls"
import DashboardContent from "./components/DashboardContent"
import ErrorDisplay from "./components/ErrorDisplay"
import LoadingIndicator from "./components/LoadingIndicator"
import { useFetchDataQualityStats } from "./hooks"

interface DataQualityDashboardProps {
  user?: unknown
  isAdmin?: boolean
}

const DataQualityDashboard = ({ isAdmin }: DataQualityDashboardProps) => {
  const t = useTranslations("dataQuality")
  const [timeframe, setTimeframe] = useState<"week" | "month" | "all">("month")
  const { stats, isInitialLoad, isFetching, error, forceRefresh } =
    useFetchDataQualityStats(timeframe)

  const handleUploadComplete = () => {
    void forceRefresh(true)
  }

  if (isInitialLoad) {
    return <LoadingIndicator />
  }

  if (error) {
    return <ErrorDisplay message={error} />
  }

  if (!stats) {
    return <div>{t("noData")}</div>
  }

  return (
    <>
      {isAdmin && <AdminCSVControls onUploadComplete={handleUploadComplete} />}
      <DashboardContent
        stats={stats}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        isFetching={isFetching}
      />
    </>
  )
}

export default DataQualityDashboard
