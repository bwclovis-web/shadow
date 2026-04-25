"use client"

import { GrEdit } from "react-icons/gr"
import { MdDeleteForever } from "react-icons/md"
import { useTranslations } from "next-intl"

import { Button, VooDooLink } from "@/components/Atoms/Button"

interface PerfumeHouseAdminActionsProps {
  houseName: string
  houseSlug: string
  onDeleteClick: () => void
}

const PerfumeHouseAdminActions = ({
  houseName,
  houseSlug,
  onDeleteClick,
}: PerfumeHouseAdminActionsProps) => {
  const t = useTranslations("admin.perfumeHouse")

  return (
    <div>
      <h2 className="text-center mb-2">
        {t("sectionHeading")}
      </h2>
      <div className="flex flex-col items-center justify-between gap-2">
        <VooDooLink
          aria-label={`edit perfume house ${houseName}`}
          variant="icon"
          background="gold"
          size="sm"
          className="flex items-center justify-between gap-2"
          url={`/admin/perfume-house/${houseSlug}/edit`}
        >
          <span>Edit Perfume House</span>
          <GrEdit size={22} />
        </VooDooLink>
        <Button
          onClick={onDeleteClick}
          aria-label={`delete perfume house ${houseName}`}
          variant="icon"
          className="flex items-center justify-between gap-2"
          background="gold"
          size="sm"
        >
          <span>Delete Perfume House</span>
          <MdDeleteForever size={22} />
        </Button>
      </div>
    </div>
  )
}

export default PerfumeHouseAdminActions
