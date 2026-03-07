"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { MdDeleteForever, MdEdit, MdCheck, MdClose } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import Select from "@/components/Atoms/Select"
import { getPerfumeTypeLabel, perfumeTypes } from "@/data/SelectTypes"
import { useCSRF } from "@/hooks/useCSRF"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"
import { formatPrice } from "@/utils/numberUtils"

const USER_PERFUMES_API = "/api/user-perfumes"

type ByTypeTotal = {
  typeLabel: string
  totalAmount: number
  bottleCount: number
}

type GeneralDetailsProps = {
  userPerfume: UserPerfumeI
  deletePerfume?: (userPerfumeId: string) => void
  isRemoving?: boolean
  /** Total amount (ml) across all entries for this perfume */
  totalAmount?: number
  /** Amount (ml) remaining after destashes */
  remainingAmount?: number
  /** Totals broken down by perfume type */
  byTypeTotals?: ByTypeTotal[]
  /** Called after the bottle details are successfully updated */
  onBottleUpdated?: (userPerfumeId: string, fields: { amount: string; type?: string; price?: string | null; placeOfPurchase?: string | null }) => void
}

const GeneralDetails = ({
  userPerfume,
  isRemoving = false,
  totalAmount,
  remainingAmount,
  byTypeTotals,
  onBottleUpdated,
}: GeneralDetailsProps) => {
  const t = useTranslations("myScents.listItem")
  const { toggleModal } = useSessionStore()
  const { addToFormData } = useCSRF()
  const removeButtonRef = useRef<HTMLButtonElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editAmount, setEditAmount] = useState(userPerfume.amount ?? "0")
  const [editType, setEditType] = useState(userPerfume.type ?? "eauDeParfum")
  const [editPrice, setEditPrice] = useState(userPerfume.price ?? "")
  const [editPlace, setEditPlace] = useState(userPerfume.placeOfPurchase ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const priceNum = userPerfume.price != null ? Number(userPerfume.price) : null
  const typeLabel = getPerfumeTypeLabel(userPerfume.type ?? undefined) ?? "—"

  const handleSave = async () => {
    if (!editAmount.trim()) {
      setSaveError(t("editAmountError"))
      return
    }
    setIsSaving(true)
    setSaveError(null)
    const formData = new FormData()
    formData.append("action", "update-bottle")
    formData.append("userPerfumeId", userPerfume.id)
    formData.append("amount", editAmount.trim())
    formData.append("type", editType)
    formData.append("price", editPrice.trim())
    formData.append("placeOfPurchase", editPlace.trim())
    addToFormData(formData)
    try {
      const res = await fetch(USER_PERFUMES_API, {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (data?.success) {
        setIsEditing(false)
        onBottleUpdated?.(userPerfume.id, {
          amount: editAmount.trim(),
          type: editType,
          price: editPrice.trim() || null,
          placeOfPurchase: editPlace.trim() || null,
        })
      } else {
        setSaveError(data?.error ?? t("editAmountSaveError"))
      }
    } catch {
      setSaveError(t("editAmountSaveError"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditAmount(userPerfume.amount ?? "0")
    setEditType(userPerfume.type ?? "eauDeParfum")
    setEditPrice(userPerfume.price ?? "")
    setEditPlace(userPerfume.placeOfPurchase ?? "")
    setSaveError(null)
  }

  return (
    <div className="flex flex-col gap-4 mt-6 px-2">
      {/* Totals row */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-10 justify-between md:items-start">
        <div className="flex items-start justify-start gap-8 flex-wrap">
          {typeof totalAmount === "number" && (
            <p className="flex flex-col items-start justify-start">
              <span className="text-lg font-medium text-noir-gold">{t("totalAmount")}</span>
              <span className="text-2xl text-noir-gold-100">{totalAmount.toFixed(1)} ml</span>
            </p>
          )}
          {typeof remainingAmount === "number" && (
            <p className="flex flex-col items-start justify-start">
              <span className="text-lg font-medium text-noir-gold">{t("remainingAmount")}</span>
              <span className="text-2xl text-noir-gold-100">{remainingAmount.toFixed(1)} ml</span>
            </p>
          )}
          {byTypeTotals && byTypeTotals.length > 1 && (
            <div>
              <p className="text-sm font-medium text-noir-gold mb-1">{t("byType")}</p>
              <ul className="flex flex-wrap gap-3">
                {byTypeTotals.map((entry) => (
                  <li key={entry.typeLabel} className="flex flex-col items-start">
                    <span className="text-xs text-noir-gold-100">{entry.typeLabel}</span>
                    <span className="text-base text-noir-gold-100">
                      {entry.totalAmount.toFixed(1)} ml
                      {entry.bottleCount > 1 && (
                        <span className="text-xs text-noir-gold-400 ml-1">({entry.bottleCount} bottles)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Button
          ref={removeButtonRef}
          onClick={() => toggleModal(removeButtonRef, "delete-item")}
          disabled={isRemoving}
          variant="icon"
          background="red"
          size="sm"
          leftIcon={<MdDeleteForever size={20} fill="white" />}
        >
          <span className="text-white/90 font-bold text-sm">
            {isRemoving ? t("removing") : t("removeButton")}
          </span>
        </Button>
      </div>

      {/* This bottle's details + edit */}
      {!isEditing ? (
        <div className="noir-border p-4 bg-noir-dark/10 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-noir-gold">{t("thisBottle")}</p>
            <Button
              onClick={() => setIsEditing(true)}
              variant="icon"
              size="sm"
              background="gold"
              className="max-w-max"
              leftIcon={<MdEdit size={16} />}
            >
              <span className="text-sm">{t("editBottle")}</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-6 mt-1">
            <p className="flex flex-col items-start">
              <span className="text-xs text-noir-gold-100">{t("amountLabel")}</span>
              <span className="text-xl text-noir-gold-100">{userPerfume.amount} ml</span>
            </p>
            <p className="flex flex-col items-start">
              <span className="text-xs text-noir-gold-100">{t("type")}</span>
              <span className="text-xl text-noir-gold-100">{typeLabel}</span>
            </p>
            {priceNum != null && !Number.isNaN(priceNum) && (
              <p className="flex flex-col items-start">
                <span className="text-xs text-noir-gold-100">{t("price")}</span>
                <span className="text-xl text-noir-gold-100">{formatPrice(priceNum)}</span>
              </p>
            )}
            {userPerfume.placeOfPurchase && (
              <p className="flex flex-col items-start">
                <span className="text-xs text-noir-gold-100">{t("pointOfPurchase")}</span>
                <span className="text-xl text-noir-gold-100 capitalize">{userPerfume.placeOfPurchase}</span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="noir-border p-4 bg-noir-dark/20 flex flex-col gap-4">
          <p className="text-sm font-semibold text-noir-gold">{t("editBottle")}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-noir-gold-100">{t("amountLabel")}</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="px-2 py-1 rounded border border-noir-gold bg-noir-dark text-noir-gold-100 text-sm"
              />
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-noir-gold-100">{t("price")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="0.00"
                className="px-2 py-1 rounded border border-noir-gold bg-noir-dark text-noir-gold-100 text-sm"
              />
            </div>

            {/* Place of purchase */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-noir-gold-100">{t("pointOfPurchase")}</label>
              <input
                type="text"
                value={editPlace}
                onChange={(e) => setEditPlace(e.target.value)}
                placeholder={t("placeOfPurchasePlaceholder")}
                className="px-2 py-1 rounded border border-noir-gold bg-noir-dark text-noir-gold-100 text-sm"
              />
            </div>

            {/* Type */}
            <Select
              selectData={perfumeTypes}
              name="editType"
              size="default"
              label={t("type")}
              selectId="editType"
              value={editType}
              action={(e) => setEditType((e.target as HTMLSelectElement).value)}
            />
          </div>

          {saveError && <p className="text-red-400 text-xs">{saveError}</p>}

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="primary"
              size="sm"
              leftIcon={<MdCheck size={16} />}
            >
              <span className="text-sm">{isSaving ? t("saving") : t("save")}</span>
            </Button>
            <Button
              onClick={handleCancelEdit}
              variant="secondary"
              size="sm"
              leftIcon={<MdClose size={16} />}
            >
              <span className="text-sm">{t("cancel")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneralDetails
