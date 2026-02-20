import { GrEdit } from "react-icons/gr"
import { MdDeleteForever } from "react-icons/md"

import { VooDooLink } from "~/components/Atoms/Button"
import { Button } from "~/components/Atoms/Button"

interface PerfumeHouseAdminActionsProps {
  isAdmin: boolean
  houseName: string
  houseSlug: string
  onDeleteClick: () => void
}

const PerfumeHouseAdminActions = ({
  isAdmin,
  houseName,
  houseSlug,
  onDeleteClick,
}: PerfumeHouseAdminActionsProps) => {
  if (!isAdmin) {
    return null
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-center text-noir-gold-500 mb-2">
        Admin
      </h2>
      <div className="flex flex-col items-center justify-between gap-2">
        <VooDooLink
          aria-label={`edit ${houseName}`}
          variant="icon"
          background="gold"
          size="sm"
          className="flex items-center justify-between gap-2"
          url={`/admin/perfume-house/${houseSlug}/edit`}
        >
          <span>Edit Perfume</span>
          <GrEdit size={22} />
        </VooDooLink>
        <Button
          onClick={onDeleteClick}
          aria-label={`delete ${houseName}`}
          variant="icon"
          className="flex items-center justify-between gap-2"
          background="gold"
          size="sm"
        >
          <span>Delete Perfume</span>
          <MdDeleteForever size={22} />
        </Button>
      </div>
    </div>
  )
}

export default PerfumeHouseAdminActions


