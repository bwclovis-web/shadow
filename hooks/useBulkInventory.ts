import { useCallback, useMemo, useState } from "react"

import { useCSRF } from "@/hooks/useCSRF"

// WARNING: action "add" does not persist condition or tradePreference — IMP-253 import action required.

export const BULK_INVENTORY_MAX_ROWS = 20

const USER_PERFUMES_API = "/api/user-perfumes"

export type BulkRowStatus = "idle" | "saving" | "saved" | "error"

export type BulkRow = {
  id: string
  perfumeId: string | null
  perfumeName: string
  amount: string
  type: string
  price: string
  placeOfPurchase: string
  status: BulkRowStatus
  errorMessage?: string
}

const createEmptyRow = (): BulkRow => ({
  id: crypto.randomUUID(),
  perfumeId: null,
  perfumeName: "",
  amount: "",
  type: "eauDeParfum",
  price: "",
  placeOfPurchase: "",
  status: "idle",
})

type SaveRowResult =
  | { success: true }
  | { success: false; errorMessage: string }

type UseBulkInventoryOptions = {
  onAllSaved?: () => void | Promise<void>
}

export const useBulkInventory = ({ onAllSaved }: UseBulkInventoryOptions = {}) => {
  const { submitForm } = useCSRF()
  const [rows, setRows] = useState<BulkRow[]>(() => [createEmptyRow()])
  const [isSavingAll, setIsSavingAll] = useState(false)

  const addRow = useCallback(() => {
    setRows(prev => {
      if (prev.length >= BULK_INVENTORY_MAX_ROWS) return prev
      return [...prev, createEmptyRow()]
    })
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows(prev => {
      const next = prev.filter(row => row.id !== id)
      return next.length > 0 ? next : [createEmptyRow()]
    })
  }, [])

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row
        const nextStatus = patch.status ?? row.status
        const clearedSaved =
          nextStatus === "idle" && row.status === "saved" ? "idle" : nextStatus
        return {
          ...row,
          ...patch,
          status:
            patch.perfumeId !== undefined || patch.amount !== undefined
              ? row.status === "saved"
                ? "idle"
                : clearedSaved
              : clearedSaved,
          errorMessage:
            patch.errorMessage !== undefined ? patch.errorMessage : undefined,
        }
      })
    )
  }, [])

  const resetRows = useCallback(() => {
    setRows([createEmptyRow()])
    setIsSavingAll(false)
  }, [])

  const canSave = useMemo(() => {
    if (isSavingAll) return false
    return rows.some(
      row => row.perfumeId && row.status !== "saved" && row.status !== "saving"
    )
  }, [rows, isSavingAll])

  const atMaxRows = rows.length >= BULK_INVENTORY_MAX_ROWS

  const submitRow = useCallback(
    async (row: BulkRow): Promise<SaveRowResult> => {
      if (!row.perfumeId) {
        return { success: false, errorMessage: "Select a perfume" }
      }

      const formData = new FormData()
      formData.append("perfumeId", row.perfumeId)
      formData.append("amount", row.amount)
      formData.append("price", row.price)
      formData.append("placeOfPurchase", row.placeOfPurchase)
      if (row.type) {
        formData.append("type", row.type)
      }
      formData.append("action", "add")

      try {
        const response = await submitForm(USER_PERFUMES_API, formData)
        const data = await response.json().catch(() => ({}))
        if (response.ok && data?.success) {
          return { success: true }
        }
        const message =
          typeof data?.error === "string" ? data.error : "Failed to add perfume"
        return { success: false, errorMessage: message }
      } catch {
        return { success: false, errorMessage: "Network error" }
      }
    },
    [submitForm]
  )

  const saveAll = useCallback(async () => {
    setIsSavingAll(true)

    const rowsToProcess = rows.filter(
      row => row.status !== "saved" && row.status !== "saving"
    )

    let allSucceeded = true
    let anySubmitted = false

    for (const row of rowsToProcess) {
      if (!row.perfumeId) {
        allSucceeded = false
        setRows(prev =>
          prev.map(r =>
            r.id === row.id
              ? { ...r, status: "error", errorMessage: "Select a perfume" }
              : r
          )
        )
        continue
      }

      setRows(prev =>
        prev.map(r =>
          r.id === row.id ? { ...r, status: "saving", errorMessage: undefined } : r
        )
      )

      const result = await submitRow(row)
      anySubmitted = true

      if (result.success) {
        setRows(prev =>
          prev.map(r => (r.id === row.id ? { ...r, status: "saved" } : r))
        )
      } else {
        allSucceeded = false
        setRows(prev =>
          prev.map(r =>
            r.id === row.id
              ? { ...r, status: "error", errorMessage: result.errorMessage }
              : r
          )
        )
      }
    }

    setIsSavingAll(false)

    if (allSucceeded && anySubmitted) {
      await onAllSaved?.()
    }
  }, [rows, submitRow, onAllSaved])

  return {
    rows,
    addRow,
    removeRow,
    updateRow,
    resetRows,
    saveAll,
    canSave,
    isSavingAll,
    atMaxRows,
  }
}
