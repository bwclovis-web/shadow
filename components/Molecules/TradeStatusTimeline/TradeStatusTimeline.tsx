"use client"

import { useTranslations } from "next-intl"

import { tradeCardTransitionName } from "@/utils/view-transition-names"
import { styleMerge } from "@/utils/styleUtils"

const TIMELINE_STATUSES = [
  "pending",
  "accepted",
  "shipped",
  "received",
  "completed",
] as const

type TimelineStatus = (typeof TIMELINE_STATUSES)[number]

const statusIndex = (status: string): number => {
  if (status === "declined" || status === "cancelled") return -1
  if (status === "draft") return -1
  const idx = TIMELINE_STATUSES.indexOf(status as TimelineStatus)
  return idx >= 0 ? idx : TIMELINE_STATUSES.length - 1
}

type TradeStatusTimelineProps = {
  tradeId: string
  status: string
  className?: string
}

const TradeStatusTimeline = ({
  tradeId,
  status,
  className,
}: TradeStatusTimelineProps) => {
  const t = useTranslations("tradeStatus")
  const current = statusIndex(status)
  const terminal = status === "declined" || status === "cancelled"

  if (terminal) {
    return (
      <p
        className={styleMerge("text-xs uppercase tracking-wide text-noir-gold-500", className)}
        style={{ viewTransitionName: tradeCardTransitionName(tradeId) } as React.CSSProperties}
      >
        {t(`status.${status}` as "status.declined")}
      </p>
    )
  }

  return (
    <ol
      className={styleMerge(
        "flex flex-wrap items-center gap-1 sm:gap-2",
        className
      )}
      aria-label={t("timelineAria")}
      style={{ viewTransitionName: tradeCardTransitionName(tradeId) } as React.CSSProperties}
    >
      {TIMELINE_STATUSES.map((step, index) => {
        const done = current >= index
        const active = current === index
        return (
          <li key={step} className="flex items-center gap-1 sm:gap-2">
            {index > 0 ? (
              <span
                className={styleMerge(
                  "hidden h-px w-3 sm:block sm:w-5",
                  done ? "bg-noir-gold/70" : "bg-noir-gold/25"
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={styleMerge(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs",
                active
                  ? "bg-noir-gold text-noir-black"
                  : done
                    ? "bg-noir-gold/25 text-noir-gold"
                    : "bg-noir-dark/60 text-noir-gold-500"
              )}
              style={
                active
                  ? ({ viewTransitionName: `trade-step-${tradeId}-${step}` } as React.CSSProperties)
                  : undefined
              }
            >
              {t(`status.${step}` as "status.pending")}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default TradeStatusTimeline
