"use client"

import { useTranslations } from "next-intl"

import { getTraderDisplayName } from "@/utils/user"

interface WishListAvailabilityInfoI {
  userPerfumes: any[]
  availableAmount: number
  perfumeName: string
}

const WishListAvailabilityInfo = ({
  userPerfumes,
  availableAmount,
  perfumeName,
}: WishListAvailabilityInfoI) => {
  const t = useTranslations("wishlist.itemCard")

  return (
    <div className="mb-4 p-3 bg-green-100 dark:bg-green-800/30 rounded-lg border border-green-200 dark:border-green-700">
      <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
        {t("availableFromCollectors", { count: userPerfumes.length })}
      </h4>
      {userPerfumes.map((userPerfume: any) => (
        <div
          key={userPerfume.id}
          className="flex justify-between items-center text-sm mb-1"
        >
          <div>
            <span className="font-medium text-green-700 dark:text-green-300">
              {getTraderDisplayName(userPerfume.user)}
            </span>
            <span className="text-green-600 dark:text-green-400 ml-2">
              {t("mlAvailable", { amount: userPerfume.available })}
            </span>
          </div>
          <a
            href={`mailto:${userPerfume.user.email}?subject=${encodeURIComponent(t("emailSubject", { perfumeName }))}&body=${encodeURIComponent(t("emailBody", { perfumeName }))}`}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 underline"
          >
            {t("contact")}
          </a>
        </div>
      ))}
      <div className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
        {t("totalAvailable", { amount: availableAmount })}
      </div>
    </div>
  )
}

export default WishListAvailabilityInfo
