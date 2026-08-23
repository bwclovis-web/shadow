"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { useLayoutEffect, useRef } from "react"
import { IoMdCloseCircle } from "react-icons/io"

import { buttonVariants } from "@/components/Atoms/Button/button-variants"
import { Button } from "@/components/Atoms/Button/Button"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { COMPARE_TRAY_PAD_VAR } from "@/constants/compare"
import { useCompareStore } from "@/hooks/compareStore"
import { normalizeRemoteImageSrc, styleMerge, validImageRegex } from "@/utils/styleUtils"

function CompareThumb({ image, alt }: { image?: string; alt: string }) {
  const normalized = normalizeRemoteImageSrc(image)
  const showRemote = normalized && !validImageRegex.test(normalized)
  const src = showRemote ? normalized : "/images/single-bottle.webp"
  return (
    <Image
      src={src}
      alt={alt}
      width={36}
      height={36}
      sizes="36px"
      className="h-9 w-9 shrink-0 rounded-sm object-cover"
    />
  )
}

/**
 * Fixed compare tray; mounted from `app/providers.tsx`.
 * @see docs/compare-client.md
 */
export function CompareTray() {
  const t = useTranslations("compare")
  const items = useCompareStore((s) => s.items)
  const maxItems = useCompareStore((s) => s.maxItems)
  const remove = useCompareStore((s) => s.remove)
  const clear = useCompareStore((s) => s.clear)
  const trayRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    if (items.length === 0) {
      root.style.removeProperty(COMPARE_TRAY_PAD_VAR)
      return
    }
    const el = trayRef.current
    if (!el) return

    const apply = () => {
      const h = el.getBoundingClientRect().height
      root.style.setProperty(COMPARE_TRAY_PAD_VAR, `${Math.ceil(h)}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty(COMPARE_TRAY_PAD_VAR)
    }
  }, [items.length])

  if (items.length === 0) return null

  return (
    <div
      role="region"
      aria-label={t("trayAriaLabel")}
      className={styleMerge(
        "fixed bottom-0 left-0 right-0 z-50 pointer-events-none",
        "bg-noir-dark/95 backdrop-blur-md border-t border-noir-light/20 mobile-safe-bottom",
        "shadow-lg"
      )}
    >
      <div
        ref={trayRef}
        className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 pointer-events-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-noir-gold">
            {t("trayTitle", {
              count: items.length,
              max: maxItems,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PrefetchLink
              href={
                items.length > 0
                  ? `/compare?ids=${items.map((i) => encodeURIComponent(i.id)).join(",")}`
                  : "/compare"
              }
              className={styleMerge(
                buttonVariants({ variant: "primary", size: "sm" }),
                "inline-flex items-center justify-center no-underline"
              )}
            >
              {t("openCompare")}
            </PrefetchLink>
            <Button type="button" variant="secondary" size="sm" onClick={clear}>
              {t("clearAll")}
            </Button>
          </div>
        </div>
        <ul className="flex list-none flex-wrap gap-2 p-0 m-0">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-sm border border-noir-gold/40 bg-noir-black/60 py-1 pl-1 pr-0.5"
            >
              <CompareThumb image={item.image} alt={item.name} />
              <span className="max-w-40 truncate text-sm text-noir-light">
                {item.name}
              </span>
              <Button
                type="button"
                variant="icon"
                size="sm"
                className="p-1! shrink-0 text-noir-gold hover:text-noir-gold-100"
                aria-label={t("removeItem", { name: item.name })}
                onClick={() => remove(item.id)}
              >
                <IoMdCloseCircle className="h-5 w-5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
