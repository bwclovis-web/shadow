import { Button } from "~/components/Atoms/Button/Button"

interface TagListProps {
  selectedTags: any[]
  label?: string
   
  onRemoveTag?: (tagId: string) => void
}

const TagList = ({ selectedTags, label, onRemoveTag }: TagListProps) => (
  <div className="flex flex-col gap-2 h-20 absolute bottom-0 w-full">
    <label htmlFor="tag-search" className="block-label">{`Current ${label}`}</label>
    <ul className="bg-white flex rounded-b-md w-full h-full overflow-x-auto">
      {selectedTags.map((item: any) => (
        <li
          key={item.id}
          className="flex items-center gap-1 p-2 hover:bg-noir-gray hover:text-noir-light cursor-pointer last-of-type:rounded-b-md whitespace-nowrap"
        >
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

export default TagList
