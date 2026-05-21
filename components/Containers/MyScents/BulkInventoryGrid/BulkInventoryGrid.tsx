"use client"

import { useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { MdAdd, MdClose } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import BulkInventoryRow from "@/components/Containers/MyScents/BulkInventoryGrid/BulkInventoryRow"
import { BULK_INVENTORY_MAX_ROWS, useBulkInventory } from "@/hooks/useBulkInventory"

type BulkInventoryGridProps = {
  existingPerfumeIds: Set<string>
  onClose: () => void
  onAllSaved: () => void | Promise<void>
}

const BulkInventoryGrid = ({
  existingPerfumeIds,
  onClose,
  onAllSaved,
}: BulkInventoryGridProps) => {
  const t = useTranslations("myScents.bulk")

  const handleAllSaved = useCallback(async () => {
    await onAllSaved()
    onClose()
  }, [onAllSaved, onClose])

  const {
    rows,
    addRow,
    removeRow,
    updateRow,
    saveAll,
    canSave,
    isSavingAll,
    atMaxRows,
  } = useBulkInventory({ onAllSaved: handleAllSaved })

  const savedCount = useMemo(
    () => rows.filter(row => row.status === "saved").length,
    [rows]
  )

  return (
    <section
      className="mx-auto mb-6 noir-border p-4 md:p-6 space-y-4"
      aria-labelledby="bulk-inventory-heading"
      data-testid="bulk-inventory-grid"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="bulk-inventory-heading" className="text-noir-gold text-xl">
            {t("title")}
          </h2>
          <p className="text-noir-gold-100 text-sm mt-1">{t("description")}</p>
        </div>
        <Button
          type="button"
          variant="icon"
          size="sm"
          onClick={onClose}
          disabled={isSavingAll}
          aria-label={t("close")}
        >
          <MdClose size={22} />
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <BulkInventoryRow
            key={row.id}
            row={row}
            rowIndex={index}
            existingPerfumeIds={existingPerfumeIds}
            disabled={isSavingAll}
            onUpdate={updateRow}
            onRemove={removeRow}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-noir-gold/30">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addRow}
          disabled={atMaxRows || isSavingAll}
          title={atMaxRows ? t("maxRowsTooltip", { max: BULK_INVENTORY_MAX_ROWS }) : undefined}
          leftIcon={<MdAdd size={18} />}
        >
          {t("addRow")}
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          {savedCount > 0 && (
            <span className="text-sm text-noir-gold-100">
              {t("savedCount", { count: savedCount })}
            </span>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={() => void saveAll()}
            disabled={!canSave}
          >
            {isSavingAll ? t("savingAll") : t("saveAll")}
          </Button>
        </div>
      </div>
    </section>
  )
}

export default BulkInventoryGrid
