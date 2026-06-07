"use client"

import { memo, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { MdCheck, MdDelete, MdError } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import Select from "@/components/Atoms/Select"
import SearchTypeahead, {
  type TypeaheadItem,
} from "@/components/Molecules/SearchTypeahead"
import { perfumeTypes } from "@/data/SelectTypes"
import type { BulkRow } from "@/hooks/useBulkInventory"

export type PerfumeSearchItem = TypeaheadItem & {
  slug: string
  perfumeHouse?: { id: string; name: string; slug?: string } | null
}

type BulkInventoryRowProps = {
  row: BulkRow
  rowIndex: number
  existingPerfumeIds: Set<string>
  disabled?: boolean
  onUpdate: (id: string, patch: Partial<BulkRow>) => void
  onRemove: (id: string) => void
}

const perfumeSearchFn = async (query: string): Promise<PerfumeSearchItem[]> => {
  const res = await fetch(`/api/perfume?name=${encodeURIComponent(query)}`)
  if (!res.ok) {
    throw new Error("Search request failed")
  }
  return (await res.json()) as PerfumeSearchItem[]
}

const BulkInventoryRow = memo(({
  row,
  rowIndex,
  existingPerfumeIds,
  disabled = false,
  onUpdate,
  onRemove,
}: BulkInventoryRowProps) => {
  const t = useTranslations("myScents.bulk")
  const tCommon = useTranslations("common")
  const tModal = useTranslations("myScents.modal")

  const isDuplicate = row.perfumeId !== null && existingPerfumeIds.has(row.perfumeId)
  const isLocked = disabled || row.status === "saving" || row.status === "saved"

  const typeSelectData = useMemo(
    () =>
      perfumeTypes.map(pt => ({
        id: pt.name,
        name: "type",
        label: pt.label,
      })),
    []
  )

  const handlePerfumeSelect = useCallback(
    (item: PerfumeSearchItem) => {
      onUpdate(row.id, {
        perfumeId: item.id,
        perfumeName: item.name,
        status: "idle",
        errorMessage: undefined,
      })
    },
    [onUpdate, row.id]
  )

  const statusIndicator = useMemo(() => {
    switch (row.status) {
      case "saving":
        return (
          <span className="text-noir-gold-100 text-sm" aria-live="polite">
            {t("status.saving")}
          </span>
        )
      case "saved":
        return (
          <span
            className="flex items-center gap-1 text-green-400 text-sm"
            aria-label={t("status.saved")}
          >
            <MdCheck size={18} aria-hidden />
            {t("status.saved")}
          </span>
        )
      case "error":
        return (
          <span
            className="flex items-center gap-1 text-red-400 text-sm"
            title={row.errorMessage}
          >
            <MdError size={18} aria-hidden />
            {row.errorMessage ?? t("status.error")}
          </span>
        )
      default:
        return null
    }
  }, [row.status, row.errorMessage, t])

  return (
    <div
      className="border border-noir-gold/40 rounded-sm p-3 bg-noir-black/40 space-y-3"
      data-testid={`bulk-inventory-row-${rowIndex}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-noir-gold text-md font-semibold">
          {t("rowLabel", { number: rowIndex + 1 })}
        </span>
        <div className="flex items-center gap-2">
          {statusIndicator}
          <Button
            type="button"
            variant="icon"
            size="sm"
            background="red"
            onClick={() => onRemove(row.id)}
            disabled={isLocked}
            aria-label={t("removeRow")}
          >
            <MdDelete size={20} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-3 items-start">
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor={`bulk-perfume-${row.id}`}
            className="block text-sm font-medium text-noir-gold-100"
          >
            {t("perfumeLabel")}
          </label>
          <SearchTypeahead<PerfumeSearchItem>
            inputId={`bulk-perfume-${row.id}`}
            label={t("perfumeLabel")}
            labelClassName="sr-only"
            placeholder={t("perfumePlaceholder")}
            searchFn={perfumeSearchFn}
            minLength={2}
            delay={300}
            inputValue={row.perfumeName}
            onInputChange={value => {
              onUpdate(row.id, {
                perfumeName: value,
                perfumeId: null,
                status: "idle",
                errorMessage: undefined,
              })
            }}
            onSelect={handlePerfumeSelect}
            optionMode="action"
            clearInputOnSelect={false}
            initialDismissed
            disabled={isLocked}
            inputClassName="w-full bg-noir-black/90 px-2 py-2 text-noir-gold-100 border border-noir-gold rounded-sm font-semibold outline-none focus:ring-2 focus:ring-noir-gold/50"
            messages={{
              loading: tCommon("loading"),
              empty: tCommon("noResultsFound"),
              formatError: (err: string) => tCommon("searchError", { error: err }),
            }}
            renderOption={(item, { highlighted }) => (
              <span className="flex flex-col gap-0.5">
                <span>{highlighted}</span>
                {item.perfumeHouse?.name && (
                  <span className="text-xs text-noir-gold-500">{item.perfumeHouse.name}</span>
                )}
              </span>
            )}
          />
          {isDuplicate && (
            <p className="text-xs text-amber-400/90">{t("duplicateWarning")}</p>
          )}
        </div>

        <Input
          inputType="text"
          name={`bulk-amount-${row.id}`}
          label={tModal("amountLabel")}
          value={row.amount}
          disabled={isLocked}
          shading
          className="w-full"
          onChange={event => {
            const target = event.target as HTMLInputElement
            onUpdate(row.id, { amount: target.value })
          }}
          placeholder={tModal("amountPlaceholder")}
        />

        <div className="flex min-w-0 w-full flex-col gap-1">
          <label
            htmlFor={`bulk-type-${row.id}`}
            className="block text-sm font-medium text-noir-gold-100"
          >
            {tModal("typeLabel")}
          </label>
          <Select
            key={`bulk-type-${row.id}-${row.type}`}
            selectId={`bulk-type-${row.id}`}
            selectData={typeSelectData}
            ariaLabel={tModal("typeLabel")}
            size="compact"
            className="w-full max-w-none md:w-full md:min-w-0 pr-0"
            defaultId={row.type || "eauDeParfum"}
            action={evt => onUpdate(row.id, { type: evt.target.value })}
            disabled={isLocked}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          inputType="number"
          name={`bulk-price-${row.id}`}
          label={tModal("priceLabel")}
          value={row.price}
          disabled={isLocked}
          shading
          className="w-full"
          onChange={event => {
            const target = event.target as HTMLInputElement
            onUpdate(row.id, { price: target.value })
          }}
          placeholder={tModal("pricePlaceholder")}
        />

        <Input
          inputType="text"
          name={`bulk-place-${row.id}`}
          label={tModal("placeOfPurchase")}
          value={row.placeOfPurchase}
          disabled={isLocked}
          shading
          className="w-full"
          onChange={event => {
            const target = event.target as HTMLInputElement
            onUpdate(row.id, { placeOfPurchase: target.value })
          }}
          placeholder={tModal("placeOfPurchasePlaceholder")}
        />
      </div>
    </div>
  )
})
BulkInventoryRow.displayName = "BulkInventoryRow"

export default BulkInventoryRow
