import { Button } from "@/components/Atoms/Button/Button"
import { styleMerge } from "@/utils/styleUtils"

type TagItem = { id: string; name: string }

export type TagListLayout = "footer" | "flow"
export type TagListSurface = "light" | "dark"

interface TagListProps {
  selectedTags: TagItem[]
  label?: string
  onRemoveTag?: (tagId: string) => void
  /** footer: absolute strip at bottom (admin forms). flow: stacks under the search input. */
  layout?: TagListLayout
  surface?: TagListSurface
}

const chipLight =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-noir-gold/20 bg-noir-gold/[0.06] px-3 py-1 text-sm font-medium text-stone-800 shadow-sm"

const chipDark =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-noir-gold/30 bg-stone-900/70 px-3 py-1 text-sm font-medium text-noir-gold-100"

export const TagList = ({
  selectedTags,
  label,
  onRemoveTag,
  layout = "footer",
  surface = "light",
}: TagListProps) => {
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

  const chipClass = isDark ? chipDark : chipLight
  const removeBtnClass = isDark
    ? "shrink-0 rounded-full p-0.5 text-red-400 transition-colors hover:bg-stone-800 hover:text-red-300"
    : "shrink-0 rounded-full p-0.5 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"

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
              isDark ? "border-stone-600/60" : "border-noir-gold"
            )
      }
    >
      <p className={headingClass}>{heading}</p>
      <ul
        className={
          isFlow
            ? styleMerge(
                "flex min-h-10 w-full flex-wrap gap-2 rounded-lg border p-3",
                isDark
                  ? "border-stone-600 bg-stone-900/40 shadow-inner"
                : "border-noir-goldbg-white/80 shadow-sm"
              )
            : styleMerge(
                "flex h-full w-full gap-2 overflow-x-auto overflow-y-hidden rounded-md px-1 py-1",
                isDark ? "bg-stone-900/30" : "bg-stone-50/80"
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
            No tags selected yet
          </li>
        )}
        {selectedTags.map(item => (
          <li key={item.id} className={chipClass}>
            <span className="min-w-0 truncate">{item.name}</span>
            {onRemoveTag && (
              <Button
                type="button"
                className={removeBtnClass}
                onClick={() => onRemoveTag(item.id)}
                title={`Remove ${item.name}`}
                aria-label={`Remove ${item.name}`}
              >
                ×
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
