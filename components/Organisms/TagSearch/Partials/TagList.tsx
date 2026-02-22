import { Button } from "@/components/Atoms/Button/Button"

type TagItem = { id: string; name: string }

interface TagListProps {
  selectedTags: TagItem[]
  label?: string
  onRemoveTag?: (tagId: string) => void
}

const listItemClasses =
  "flex items-center gap-1 p-2 hover:bg-noir-gray hover:text-noir-light cursor-pointer last-of-type:rounded-b-md whitespace-nowrap"

export const TagList = ({ selectedTags, label, onRemoveTag }: TagListProps) => (
  <div className="flex flex-col gap-2 h-20 absolute bottom-0 w-full">
    <span className="block-label" aria-hidden>
      {label ? `Current ${label}` : "Selected tags"}
    </span>
    <ul className="bg-white flex rounded-b-md w-full h-full overflow-x-auto" role="list">
      {selectedTags.map(item => (
        <li key={item.id} className={listItemClasses}>
          <span>{item.name}</span>
          {onRemoveTag && (
            <Button
              type="button"
              className="ml-1 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"
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
