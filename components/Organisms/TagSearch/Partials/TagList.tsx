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

const listItemClassesLight =
  "flex items-center gap-1 p-2 hover:bg-noir-gray hover:text-noir-light cursor-pointer last-of-type:rounded-b-md whitespace-nowrap"

const listItemClassesDark =
  "flex items-center gap-1 rounded border border-stone-500 bg-stone-900/60 px-2 py-1 text-sm text-noir-gold-100 whitespace-nowrap"

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
  const listItemClasses = isDark ? listItemClassesDark : listItemClassesLight
  const removeBtnClass = isDark
    ? "ml-1 p-1 text-red-400 hover:text-red-300 hover:bg-stone-700 rounded-full"
    : "ml-1 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"

  return (
    <div
      className={
        isFlow
          ? "flex w-full flex-col gap-2"
          : "absolute bottom-0 flex h-20 w-full flex-col gap-2"
      }
    >
      <span
        className={styleMerge(
          isFlow ? "text-sm font-medium text-noir-gold-100" : "block-label"
        )}
        aria-hidden
      >
        {heading}
      </span>
      <ul
        className={
          isFlow
            ? styleMerge(
                "flex min-h-10 w-full flex-wrap gap-2 rounded-md border p-2",
                isDark
                  ? "border-stone-600 bg-stone-800/80"
                  : "border-stone-200 bg-white"
              )
            : styleMerge(
                "flex h-full w-full overflow-x-auto rounded-b-md",
                isDark ? "bg-stone-800/90" : "bg-white"
              )
        }
        role="list"
      >
        {selectedTags.map((item) => (
          <li key={item.id} className={listItemClasses}>
            <span>{item.name}</span>
            {onRemoveTag && (
              <Button
                type="button"
                className={removeBtnClass}
                onClick={() => onRemoveTag(item.id)}
                title={`Remove ${item.name}`}
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
