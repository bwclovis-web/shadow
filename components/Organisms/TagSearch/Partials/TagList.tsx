"use client"

import { useTranslations } from "next-intl"

import { RemovableChip } from "@/components/Molecules/RemovableChip"
import { styleMerge } from "@/utils/styleUtils"

type TagItem = { id: string; name: string }

export type TagListLayout = "footer" | "flow"
export type TagListSurface = "light" | "dark"

interface TagListProps {
  type: "exchange" | "wishlist"
  selectedTags: TagItem[]
  label?: string
  onRemoveTag?: (tagId: string) => void
  layout?: TagListLayout
  surface?: TagListSurface
}

export const TagList = ({
  type,
  selectedTags,
  label,
  onRemoveTag,
  layout = "footer",
  surface = "light",
}: TagListProps) => {
  const t = useTranslations("components.tagList")
  const isFlow = layout === "flow"
  const isDark = surface === "dark"
  const heading =
    label != null && label !== ""
      ? isFlow
        ? label
        : `Current ${label}`
      : isFlow
        ? "Selected"
        : "Selected tags"

  const headingClass = styleMerge(
    isFlow
      ? styleMerge(
          "text-xs font-semibold uppercase tracking-wider",
          isDark ? "text-noir-gold-100/90" : "text-stone-600"
        )
      : "block-label"
  )

  return (
    <div
      className={
        isFlow
          ? "flex w-full flex-col gap-2"
          : styleMerge(
              "absolute bottom-0 left-0 right-0 z-10 flex max-h-24 flex-col gap-1.5 border-t pt-2",
              isDark ? "border-noir-gold-100/60" : "border-noir-gold"
            )
      }
    >
      <p className={headingClass}>{heading}</p>
      <ul
        className={
          isFlow
            ? styleMerge(
                "flex min-h-10 w-full flex-wrap gap-2 rounded-lg border p-3 mb-4",
                isDark
                  ? "border-noir-gold-100  bg-noir-dark/40 shadow-inner"
                : "border-noir-gold bg-noir-gold/10 shadow-sm"
              )
            : styleMerge(
                "flex h-full w-full gap-2 overflow-x-auto overflow-y-hidden rounded-md px-1 py-1",
                isDark ? "bg-noir-dark/30" : "bg-noir-gold/10"
              )
        }
        role="list"
        aria-label={heading}
      >
        {selectedTags.length === 0 && isFlow && (
          <li
            className={styleMerge(
              "w-full py-2 text-center text-sm italic",
              isDark ? "text-stone-500" : "text-stone-400"
            )}
          >
            {type === "exchange" ? t("emptyExchange") : t("emptyWishlist")}
          </li>
        )}
        {selectedTags.map(item =>
          onRemoveTag ? (
            <RemovableChip
              key={item.id}
              visual="tag"
              tone={isDark ? "dark" : "light"}
              label={item.name}
              onRemove={() => onRemoveTag(item.id)}
              removeAriaLabel={`Remove ${item.name}`}
              removeTitle={`Remove ${item.name}`}
            />
          ) : (
            <RemovableChip
              key={item.id}
              visual="tag"
              tone={isDark ? "dark" : "light"}
              label={item.name}
            />
          )
        )}
      </ul>
    </div>
  )
}
