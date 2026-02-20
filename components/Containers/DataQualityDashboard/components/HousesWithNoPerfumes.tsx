import { useState } from "react"
import { NavLink } from "react-router"

import { ROUTE_PATH as PERFUME_HOUSE } from "~/routes/perfume-house"
import { createUrlSlug } from "~/utils/slug"

import { type DataQualityStats } from "../utils/chartDataUtils"

interface HousesWithNoPerfumesProps {
  stats: DataQualityStats
}

type FilterType = "no-perfumes" | "missing-info" | "all"

const HousesWithNoPerfumes = ({ stats }: HousesWithNoPerfumesProps) => {
  const [filter, setFilter] = useState<FilterType>("no-perfumes")

  const housesNoPerfumes = stats.housesNoPerfumes || []
  const missingHouseInfoByBrand = stats.missingHouseInfoByBrand || {}

  // Get houses with missing info
  const housesWithMissingInfo = 
    Object.entries(missingHouseInfoByBrand).map(([name, count]) => ({
      name,
      missingFieldsCount: count,
    }))

  // Determine which data to show based on filter
  const getFilteredData = () => {
    switch (filter) {
      case "no-perfumes":
        return {
          houses: housesNoPerfumes,
          count: housesNoPerfumes.length,
          showMissingFields: false,
        }
      case "missing-info":
        return {
          houses: housesWithMissingInfo,
          count: housesWithMissingInfo.length,
          showMissingFields: true,
        }
      case "all":
        // Combine both - houses with no perfumes OR missing info
        { const allIssues = [
          ...housesNoPerfumes.map(house => ({ ...house, issue: "No Perfumes" })),
          ...housesWithMissingInfo.map(house => ({
            ...house,
            issue: "Missing Info",
          })),
        ]
        return {
          houses: allIssues,
          count: allIssues.length,
          showMissingFields: false,
          showIssueType: true,
        } }
      default:
        return { houses: [], count: 0, showMissingFields: false }
    }
  }

  const filteredData = getFilteredData()

  if (housesNoPerfumes.length === 0 && housesWithMissingInfo.length === 0) {
    return null
  }

  return (
    <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-purple-900">
          House Data Issues ({stats.totalHousesNoPerfumes || 0} no perfumes,{" "}
          {stats.totalMissingHouseInfo || 0} missing info)
        </h3>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 border-b border-purple-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setFilter("no-perfumes")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "no-perfumes"
                ? "border-purple-600 text-purple-900"
                : "border-transparent text-purple-600 hover:text-purple-900 hover:border-purple-300"
            }`}
          >
            No Perfumes ({housesNoPerfumes.length})
          </button>
          <button
            onClick={() => setFilter("missing-info")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "missing-info"
                ? "border-purple-600 text-purple-900"
                : "border-transparent text-purple-600 hover:text-purple-900 hover:border-purple-300"
            }`}
          >
            Missing Info ({housesWithMissingInfo.length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "all"
                ? "border-purple-600 text-purple-900"
                : "border-transparent text-purple-600 hover:text-purple-900 hover:border-purple-300"
            }`}
          >
            All Issues ({housesNoPerfumes.length + housesWithMissingInfo.length})
          </button>
        </nav>
      </div>

      <p className="text-sm text-purple-700 mb-4">
        {filter === "no-perfumes" &&
          "These perfume houses exist in the database but have no perfumes listed."}
        {filter === "missing-info" &&
          "These perfume houses are missing information like description, website, founded date, or image."}
        {filter === "all" &&
          "All houses with either no perfumes or missing information."}
      </p>

      <div className="max-h-96 overflow-y-auto">
        <table className="min-w-full divide-y divide-purple-200">
          <thead className="bg-purple-100 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                House Name
              </th>
              {!filteredData.showMissingFields && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  Type
                </th>
              )}
              {filteredData.showMissingFields && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  Missing Fields
                </th>
              )}
              {filteredData.showIssueType && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  Issue
                </th>
              )}
              {!filteredData.showMissingFields && (
                <th className="px-4 py-3 text-left text-xs font-medium text-purple-900 uppercase tracking-wider">
                  Created At
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-purple-100">
            {filteredData.houses.map((house: any, index) => (
              <tr
                key={house.id || house.name || index}
                className="hover:bg-purple-50"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  <NavLink
                    to={`${PERFUME_HOUSE}/${createUrlSlug(house.name)}`}
                    className="text-purple-700 hover:text-purple-900 hover:underline"
                  >
                    {house.name}
                  </NavLink>
                </td>
                {!filteredData.showMissingFields && house.type && (
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                    {house.type}
                  </td>
                )}
                {filteredData.showMissingFields && house.missingFieldsCount && (
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {house.missingFieldsCount} field
                    {house.missingFieldsCount > 1 ? "s" : ""}
                  </td>
                )}
                {filteredData.showIssueType && house.issue && (
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        house.issue === "No Perfumes"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {house.issue}
                    </span>
                  </td>
                )}
                {!filteredData.showMissingFields && house.createdAt && (
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(house.createdAt).toLocaleDateString("en-US")}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HousesWithNoPerfumes
