"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { useRef } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import RangeSlider from "@/components/Atoms/RangeSlider"
import Select from "@/components/Atoms/Select"
import SearchBar from "@/components/Organisms/SearchBar"
import { perfumeTypes } from "@/data/SelectTypes"
import {
  useMyScentsForm,
  type OptimisticCollectionItem,
} from "@/hooks/useMyScentsForm"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"

interface MyScentsModalProps {
  perfume?: UserPerfumeI
  /** Called after a perfume is successfully added to the collection. */
  onAddedToCollection?: () => void
  /** Called immediately to show an optimistic perfume entry. */
  onOptimisticAddToCollection?: (item: OptimisticCollectionItem) => void
  /** Called when optimistic add should be rolled back. */
  onOptimisticAddRollback?: (tempId: string) => void
}

const MyScentsModal = ({
  perfume,
  onAddedToCollection,
  onOptimisticAddToCollection,
  onOptimisticAddRollback,
}: MyScentsModalProps) => {
  const { modalData } = useSessionStore()
  const t = useTranslations("myScents.modal")

  const priceInputRef = useRef<HTMLInputElement>(null)
  const placeInputRef = useRef<HTMLInputElement>(null)

  const [form] = useForm({
    id: "perfume-form",
  })

  const {
    selectedPerfume,
    perfumeData,
    setPerfumeData,
    handleClick,
    handleAddPerfume,
  } = useMyScentsForm(perfume, onAddedToCollection, {
    onOptimisticAdd: onOptimisticAddToCollection,
    onOptimisticAddRollback,
  })

  return (
    <div className="w-full p-6">
      <div className="flex flex-col items-start justify-between mb-4">
        <div>
          <h2>{t("title")}</h2>
          <p className="text-xl text-noir-gold-100">{t("description")}</p>
        </div>
        {modalData?.action === "create" && !perfume && (
          <SearchBar
            variant="animated"
            searchType="perfume"
            className="mt-4"
            action={(item: UserPerfumeI) => handleClick(item)}
          />
        )}
      </div>

      {selectedPerfume && (
        <form
          className="mt-4 pb-10 md:pb-0"
          {...getFormProps(form)}
          onSubmit={handleAddPerfume}
        >
          <fieldset>
            <legend className="text-xl font-semibold text-noir-gold tracking-wide">
              {t("selectedPerfume")}
            </legend>
            <p className="text-noir-gold-100 mb-4 font-semibold">
              {"perfume" in selectedPerfume
                ? selectedPerfume.perfume?.name
                : (selectedPerfume as { name?: string }).name ?? ""}
            </p>
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
              <div className="w-full md:w-1/2 noir-border relative p-4">
                <RangeSlider
                  min={0}
                  max={250}
                  step={0.1}
                  value={parseFloat(perfumeData.amount) || 0}
                  onChange={value => {
                    setPerfumeData({
                      ...perfumeData,
                      amount: value.toFixed(1),
                    })
                  }}
                  formatValue={value => value.toFixed(1)}
                  label={t("amountLabel")}
                  showManualInput={true}
                  inputPlaceholder="Enter amount (0-10ml)"
                />
              </div>
              <div className="w-full md:w-1/2 noir-border relative p-4">
                <Select
                  selectData={perfumeTypes}
                  name="type"
                  size="default"
                  label={t("typeLabel")}
                  selectId="type"
                  value={perfumeData.type}
                  action={evt => {
                    const target = evt.target
                    setPerfumeData({
                      ...perfumeData,
                      type: target.value,
                    })
                  }}
                />
                <Input
                  inputType="number"
                  name="price"
                  shading={true}
                  label={t("priceLabel")}
                  value={perfumeData.price}
                  inputRef={priceInputRef}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    setPerfumeData({
                      ...perfumeData,
                      price: target.value,
                    })
                  }}
                  className="mt-4 w-full"
                  placeholder={t("pricePlaceholder")}
                />
                <Input
                  inputType="text"
                  name="placeOfPurchase"
                  label={t("placeOfPurchase")}
                  value={perfumeData.placeOfPurchase}
                  inputRef={placeInputRef}
                  shading={true}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    setPerfumeData({
                      ...perfumeData,
                      placeOfPurchase: target.value,
                    })
                  }}
                  className="mt-4 w-full"
                  placeholder={t("placeOfPurchasePlaceholder")}
                />
              </div>
            </div>
          </fieldset>
          <Button type="submit" className="mt-6">
            {t("submitButton")}
          </Button>
        </form>
      )}
    </div>
  )
}

export default MyScentsModal
