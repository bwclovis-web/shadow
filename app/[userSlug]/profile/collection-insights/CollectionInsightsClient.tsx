"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import type { CollectionInsights } from "@/models/collection-insights.server"
import { apiFetch } from "@/lib/api-client"

type CollectionInsightsClientProps = {
  insights: CollectionInsights
  membershipHref: string
}

export const CollectionInsightsClient = ({
  insights,
  membershipHref,
}: CollectionInsightsClientProps) => {
  const t = useTranslations("collectionInsights")

  const downloadCsv = async () => {
    try {
      const res = await apiFetch<{ csv: string }>("/api/collection-insights/export")
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "collection-export.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* entitlement or auth failure surfaced by apiFetch */
    }
  }

  return (
    <div className="space-y-8 text-noir-gold-100">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="noir-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide opacity-70">{t("bottles")}</p>
          <p className="text-2xl text-noir-gold-500 mt-1">{insights.bottleCount}</p>
        </div>
        <div className="noir-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide opacity-70">{t("houses")}</p>
          <p className="text-2xl text-noir-gold-500 mt-1">{insights.houseCount}</p>
        </div>
        <div className="noir-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide opacity-70">{t("recentWears")}</p>
          <p className="text-2xl text-noir-gold-500 mt-1">{insights.recentWearCount}</p>
        </div>
        <div className="noir-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide opacity-70">{t("tradedValue")}</p>
          <p className="text-2xl text-noir-gold-500 mt-1">
            {insights.tradedValue.toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </section>

      {insights.topFamilies.length > 0 && (
        <section>
          <h2 className="text-lg text-noir-gold-500 mb-3">{t("topFamilies")}</h2>
          <ul className="flex flex-wrap gap-2">
            {insights.topFamilies.map(f => (
              <li
                key={f.name}
                className="text-sm border border-noir-gold/30 rounded-full px-3 py-1"
              >
                {f.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights.rotationScore != null ? (
        <section className="space-y-4">
          <h2 className="text-lg text-noir-gold-500">{t("premiumTitle")}</h2>
          <div className="noir-border rounded-lg p-4">
            <p className="text-sm opacity-80">{t("rotationLabel")}</p>
            <p className="text-3xl text-noir-gold-500 mt-1">{insights.rotationScore}%</p>
            <p className="text-xs opacity-60 mt-2">{t("rotationHelp")}</p>
          </div>

          {insights.seasonCoverage && (
            <div>
              <h3 className="text-sm uppercase tracking-wide opacity-70 mb-2">
                {t("seasonCoverage")}
              </h3>
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {insights.seasonCoverage.map(s => (
                  <li key={s.season} className="noir-border rounded p-3 text-sm">
                    <span className="capitalize opacity-80">{s.season}</span>
                    <p className="text-noir-gold-500 text-lg">{s.wearCount}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.neglectedBottles && insights.neglectedBottles.length > 0 && (
            <div>
              <h3 className="text-sm uppercase tracking-wide opacity-70 mb-2">
                {t("neglected")}
              </h3>
              <ul className="space-y-2">
                {insights.neglectedBottles.map(b => (
                  <li
                    key={b.perfumeId}
                    className="flex justify-between gap-2 noir-border rounded p-3 text-sm"
                  >
                    <PrefetchLink
                      href={`/perfume/${b.slug}`}
                      className="text-noir-gold-500 hover:underline"
                    >
                      {b.name}
                    </PrefetchLink>
                    <span className="opacity-60 text-xs">
                      {t("ownedDays", { days: b.ownedDays })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.declaredVsActual?.narrative ? (
            <div className="noir-border rounded-lg p-4">
              <h3 className="text-sm uppercase tracking-wide opacity-70 mb-2">
                {t("declaredVsActual")}
              </h3>
              <p className="text-sm">{insights.declaredVsActual.narrative}</p>
            </div>
          ) : null}

          {insights.advanced ? (
            <div className="space-y-4">
              {insights.advanced.redundancy.length > 0 ? (
                <div>
                  <h3 className="text-sm uppercase tracking-wide opacity-70 mb-2">
                    {t("redundancy")}
                  </h3>
                  <ul className="space-y-2">
                    {insights.advanced.redundancy.map(r => (
                      <li key={r.family} className="noir-border rounded p-3 text-sm">
                        <p className="text-noir-gold-500 capitalize">
                          {r.family} ({r.count})
                        </p>
                        <p className="opacity-70 text-xs mt-1">
                          {r.perfumeNames.join(", ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {insights.advanced.gaps.length > 0 ? (
                <div>
                  <h3 className="text-sm uppercase tracking-wide opacity-70 mb-2">
                    {t("gaps")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {insights.advanced.gaps.map(g => (
                      <li key={g.family}>{g.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="noir-border rounded p-3 text-sm">
                <h3 className="text-sm uppercase tracking-wide opacity-70 mb-2">
                  {t("decantMix")}
                </h3>
                <p>
                  {t("decantMixCounts", {
                    full: insights.advanced.mix.fullBottles,
                    decants: insights.advanced.mix.decants,
                    unknown: insights.advanced.mix.unknown,
                  })}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="noir-border rounded-lg p-4 space-y-2">
          <h2 className="text-lg text-noir-gold-500">{t("premiumTitle")}</h2>
          <p className="text-sm opacity-80">{t("premiumRequired")}</p>
          <Link href={membershipHref} className="text-sm underline text-noir-gold-500">
            {t("upgradeCta")}
          </Link>
        </section>
      )}

      {insights.canExport ? (
        <section>
          <button
            type="button"
            onClick={() => void downloadCsv()}
            className="text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5"
          >
            {t("exportCsv")}
          </button>
        </section>
      ) : (
        <p className="text-xs opacity-60">{t("exportCollectorOnly")}</p>
      )}
    </div>
  )
}
