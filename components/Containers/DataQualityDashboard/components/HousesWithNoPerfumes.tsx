import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useState } from "react"

import { HOUSE_DETAIL_PATH } from "@/constants/routes"

import { type DataQualityStats } from "@/lib/queries/dataQuality"

interface HousesWithNoPerfumesProps {
  stats: DataQualityStats
}

type FilterType = "no-perfumes" | "missing-info" | "all"

const HousesWithNoPerfumes = ({ stats }: HousesWithNoPerfumesProps) => {
  const t = useTranslations("dataQuality.houseIssues")
  const tf = useTranslations("dataQuality.fieldLabels")
  const housesNoPerfumes = stats.housesNoPerfumes || []
  const withMissing = stats.housesWithMissingHouseInfo || []

  const [filter, setFilter] = useState<FilterType>("no-perfumes")

  const translateField = (key: string) => {
    if (key === "description" || key === "website" || key === "email") {
      return tf(key)
    }
    return key
  }

  const getFilteredData = () => {
    switch (filter) {
      case "no-perfumes":
        return {
          houses: housesNoPerfumes,
          count: housesNoPerfumes.length,
          mode: "no-perfumes" as const,
        }
      case "missing-info":
        return {
          houses: withMissing,
          count: withMissing.length,
          mode: "missing-info" as const,
        }
      case "all": {
        const noPerf = housesNoPerfumes.map(h => ({ ...h, issue: "no-perfumes" as const }))
        const miss = withMissing.map(h => ({ ...h, issue: "missing-info" as const }))
        const allIssues = [...noPerf, ...miss]
        return {
          houses: allIssues,
          count: allIssues.length,
          mode: "all" as const,
        }
      }
      default:
        return { houses: [], count: 0, mode: "no-perfumes" as const }
    }
  }

  const filteredData = getFilteredData()

  if (housesNoPerfumes.length === 0 && withMissing.length === 0) {
    return null
  }

  return (
    <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-purple-900">
          {t("title", {
            noPerfumes: stats.totalHousesNoPerfumes || 0,
            missingInfo: stats.totalMissingHouseInfo || 0,
          })}
        </h3>
      </div>

      <div className="mb-4 border-b border-purple-200">
        <nav className="flex space-x-4">
          <button
            type="button"
            onClick={() => setFilter("no-perfumes")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "no-perfumes"
                ? "border-purple-600 text-purple-900"
                : "border-transparent text-purple-600 hover:text-purple-900 hover:border-purple-300"
            }`}
          >
            {t("tabNoPerfumes", { count: housesNoPerfumes.length })}
          </button>
          <button
            type="button"
            onClick={() => setFilter("missing-info")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "missing-info"
                ? "border-purple-600 text-purple-900"
                : "border-transparent text-purple-600 hover:text-purple-900 hover:border-purple-300"
            }`}
          >
            {t("tabMissingInfo", { count: withMissing.length })}
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "all"
                ? "border-purple-600 text-purple-900"
                : "border-transparent text-purple-600 hover:text-purple-900 hover:border-purple-300"
            }`}
          >
            {t("tabAll", { count: housesNoPerfumes.length + withMissing.length })}
          </button>
        </nav>
      </div>

      <p className="text-sm text-purple-700 mb-4">
        {filter === "no-perfumes" && t("hintNoPerfumes")}
        {filter === "missing-info" && t("hintMissingInfo")}
        {filter === "all" && t("hintAll")}
      </p>

      <div className="max-h-96 overflow-y-auto">
        <table className="min-w-full divide-y divide-purple-200">
          <thead className="bg-purple-100 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                {t("colHouse")}
              </th>
              {filteredData.mode === "no-perfumes" && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  {t("colType")}
                </th>
              )}
              {filteredData.mode === "missing-info" && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  {t("colMissingFields")}
                </th>
              )}
              {filteredData.mode === "all" && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  {t("colIssue")}
                </th>
              )}
              {filteredData.mode === "no-perfumes" && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  {t("colCreated")}
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                {t("colActions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-purple-100">
            {filteredData.houses.map((house, index) => {
              const rowKey = "issue" in house ? `${house.id}-${house.issue}` : house.id || index
              const slug = house.slug
              const publicHref = `${HOUSE_DETAIL_PATH}/${slug}`

              return (
                <tr key={rowKey} className="hover:bg-purple-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <PrefetchLink
                      href={publicHref}
                      prefetch={false}
                      className="text-purple-700 hover:text-purple-900 hover:underline"
                    >
                      {house.name}
                    </PrefetchLink>
                  </td>
                  {filteredData.mode === "no-perfumes" && "type" in house && (
                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">{house.type}</td>
                  )}
                  {filteredData.mode === "missing-info" && "missingFields" in house && (
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {house.missingFields.map(translateField).join(", ")}
                    </td>
                  )}
                  {filteredData.mode === "all" && "issue" in house && (
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          house.issue === "no-perfumes"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {house.issue === "no-perfumes" ? t("badgeNoPerfumes") : t("badgeMissingInfo")}
                      </span>
                    </td>
                  )}
                  {filteredData.mode === "no-perfumes" && "createdAt" in house && house.createdAt && (
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(house.createdAt).toLocaleDateString()}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm">
                    <PrefetchLink
                      href={`/admin/perfume-house/${slug}/edit`}
                      prefetch={false}
                      className="text-purple-700 hover:text-purple-900 hover:underline"
                    >
                      {t("editAdmin")}
                    </PrefetchLink>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HousesWithNoPerfumes
