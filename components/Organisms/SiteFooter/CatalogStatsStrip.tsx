import { getTranslations } from "next-intl/server"

import type { CatalogStats } from "@/models/catalog-stats.server"

type CatalogStatsStripProps = {
  stats: CatalogStats
}

const CatalogStatsStrip = async ({ stats }: CatalogStatsStripProps) => {
  const t = await getTranslations("siteFooter.catalogStats")

  const items = [
    t("users", { count: stats.users }),
    t("houses", { count: stats.houses }),
    t("perfumes", { count: stats.perfumes }),
  ]

  return (
    <p
      className="text-xs text-noir-gold/80 md:text-sm"
      aria-label={t("ariaLabel", {
        users: stats.users,
        houses: stats.houses,
        perfumes: stats.perfumes,
      })}
    >
      {items.map((label, index) => (
        <span key={index} className="inline-flex items-center gap-x-2">
          {index > 0 ? (
            <span aria-hidden className="text-noir-gold/50">
              {t("separator")}
            </span>
          ) : null}
          <span>{label}</span>
        </span>
      ))}
    </p>
  )
}

export default CatalogStatsStrip
