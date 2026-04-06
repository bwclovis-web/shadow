import { type FC } from "react"
import { useTranslations } from "next-intl"

import { type DataQualityStats } from "@/lib/queries/dataQuality"

interface SummaryStatsProps {
  stats: DataQualityStats
}

const SummaryStats: FC<SummaryStatsProps> = ({ stats }) => {
  const t = useTranslations("dataQuality.summary")

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-red-800">{t("missingTitle")}</h3>
        <p className="text-3xl font-bold text-red-600 mt-2">{stats.totalMissing}</p>
        <p className="text-sm text-red-700 mt-1">{t("missingHint")}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-800">{t("duplicatesTitle")}</h3>
        <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalDuplicates}</p>
        <p className="text-sm text-blue-700 mt-1">{t("duplicatesHint")}</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-yellow-800">{t("missingHouseTitle")}</h3>
        <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.totalMissingHouseInfo || 0}</p>
        <p className="text-sm text-yellow-700 mt-1">{t("missingHouseHint")}</p>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-purple-800">{t("emptyHousesTitle")}</h3>
        <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalHousesNoPerfumes || 0}</p>
        <p className="text-sm text-purple-700 mt-1">{t("emptyHousesHint")}</p>
      </div>
    </div>
  )
}

export default SummaryStats
