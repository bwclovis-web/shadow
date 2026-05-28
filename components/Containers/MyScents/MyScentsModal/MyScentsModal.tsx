"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { useCallback, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import RangeSlider from "@/components/Atoms/RangeSlider"
import Select from "@/components/Atoms/Select"
import { HouseAutocomplete, type HouseAutocompleteOption } from "@/components/Molecules/HouseAutocomplete"
import SearchBar from "@/components/Organisms/SearchBar"
import { perfumeTypes } from "@/data/SelectTypes"
import { useCSRF } from "@/hooks/useCSRF"
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
  autoFocusSearch?: boolean
}

const MyScentsModal = ({
  perfume,
  onAddedToCollection,
  onOptimisticAddToCollection,
  onOptimisticAddRollback,
  autoFocusSearch = false,
}: MyScentsModalProps) => {
  const { modalData, closeModal } = useSessionStore()
  const t = useTranslations("myScents.modal")
  const { submitForm } = useCSRF()

  const priceInputRef = useRef<HTMLInputElement>(null)
  const placeInputRef = useRef<HTMLInputElement>(null)
  const manualPriceInputRef = useRef<HTMLInputElement>(null)
  const manualPlaceInputRef = useRef<HTMLInputElement>(null)

  const [form] = useForm({
    id: "perfume-form",
  })
  const [manualMode, setManualMode] = useState(false)
  const [allowCustomHouse, setAllowCustomHouse] = useState(false)
  const [manualHouse, setManualHouse] = useState<HouseAutocompleteOption | null>(
    null
  )
  const [manualData, setManualData] = useState({
    perfumeName: "",
    customHouseName: "",
    amount: "",
    type: "",
    price: "",
    placeOfPurchase: "",
  })
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualSubmitting, setManualSubmitting] = useState(false)

  const handleAddSuccess = useCallback(() => {
    closeModal()
    onAddedToCollection?.()
  }, [closeModal, onAddedToCollection])

  const {
    selectedPerfume,
    perfumeData,
    setPerfumeData,
    handleClick,
    handleAddPerfume,
  } = useMyScentsForm(perfume, handleAddSuccess, {
    onOptimisticAdd: onOptimisticAddToCollection,
    onOptimisticAddRollback,
  })

  const handleManualAdd = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setManualError(null)
      setManualSubmitting(true)

      try {
        const formData = new FormData()
        formData.set("perfumeName", manualData.perfumeName)
        if (allowCustomHouse) {
          formData.set("customHouseName", manualData.customHouseName)
        } else if (manualHouse?.id) {
          formData.set("existingHouseId", manualHouse.id)
        }
        formData.set("amount", manualData.amount || "0")
        if (manualData.type) {
          formData.set("type", manualData.type)
        }
        if (manualData.price) {
          formData.set("price", manualData.price)
        }
        if (manualData.placeOfPurchase) {
          formData.set("placeOfPurchase", manualData.placeOfPurchase)
        }

        const response = await submitForm("/api/user-perfumes/manual-entry", formData)
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data?.success) {
          setManualError(
            typeof data?.error === "string"
              ? data.error
              : "Unable to add this perfume right now."
          )
          return
        }

        closeModal()
        onAddedToCollection?.()
      } catch {
        setManualError("Unable to add this perfume right now.")
      } finally {
        setManualSubmitting(false)
      }
    },
    [
      allowCustomHouse,
      closeModal,
      manualData.amount,
      manualData.customHouseName,
      manualData.perfumeName,
      manualData.placeOfPurchase,
      manualData.price,
      manualData.type,
      manualHouse?.id,
      onAddedToCollection,
      submitForm,
    ]
  )

  return (
    <div className="w-full p-6">
      <div className="flex flex-col items-start justify-between mb-4">
        <div>
          <h2>{t("title")}</h2>
          <p className="text-xl text-noir-gold-100">{t("description")}</p>
        </div>
        {modalData?.action === "create" && !perfume && (
          <>
            {!manualMode && (
              <>
                <SearchBar
                  variant="animated"
                  searchType="perfume"
                  className="mt-4"
                  autoFocus={autoFocusSearch}
                  action={item => handleClick(item as unknown as UserPerfumeI)}
                  footerSlot={
                    <li className="border-t border-noir-gold/20 p-2" role="presentation">
                      <button
                        type="button"
                        className="w-full rounded px-2 py-1 text-left text-sm text-noir-gold-100 hover:bg-noir-gold/10"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => setManualMode(true)}
                      >
                        Can&apos;t find it? Add manually
                      </button>
                    </li>
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setManualMode(true)}
                >
                  Can&apos;t find it? Add manually
                </Button>
              </>
            )}
            {manualMode && (
              <form
                onSubmit={handleManualAdd}
                className="mt-4 w-full rounded-md border border-noir-gold/30 bg-noir-black/20 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-noir-gold-100">
                    Add a placeholder entry now. Admins will review details.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setManualMode(false)}
                  >
                    Back to search
                  </Button>
                </div>
                <Input
                  inputType="text"
                  name="manualPerfumeName"
                  label="Perfume Name"
                  value={manualData.perfumeName}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    setManualData(prev => ({ ...prev, perfumeName: target.value }))
                  }}
                  className="w-full"
                  placeholder="Enter perfume name"
                  required
                  shading
                />
                {!allowCustomHouse && (
                  <HouseAutocomplete
                    selected={manualHouse}
                    onSelect={setManualHouse}
                    inputId="manual-house"
                    label="Perfume House"
                    clearLabel="Clear"
                    className="mt-4"
                  />
                )}
                <div className="mt-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-noir-gold-100">
                    <input
                      type="checkbox"
                      checked={allowCustomHouse}
                      onChange={event => {
                        const checked = event.target.checked
                        setAllowCustomHouse(checked)
                        if (checked) setManualHouse(null)
                      }}
                    />
                    House not listed
                  </label>
                </div>
                {allowCustomHouse && (
                  <Input
                    inputType="text"
                    name="manualCustomHouseName"
                    label="Custom House Name"
                    value={manualData.customHouseName}
                    onChange={event => {
                      const target = event.target as HTMLInputElement
                      setManualData(prev => ({
                        ...prev,
                        customHouseName: target.value,
                      }))
                    }}
                    className="mt-4 w-full"
                    placeholder="Enter house name"
                    required
                    shading
                  />
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input
                    inputType="text"
                    name="manualAmount"
                    label={t("amountLabel")}
                    value={manualData.amount}
                    onChange={event => {
                      const target = event.target as HTMLInputElement
                      setManualData(prev => ({ ...prev, amount: target.value }))
                    }}
                    className="w-full"
                    placeholder={t("amountPlaceholder")}
                    required
                    shading
                  />
                  <Select
                    selectData={perfumeTypes}
                    name="manualType"
                    size="compact"
                    label={t("typeLabel")}
                    selectId="manual-type"
                    value={manualData.type}
                    action={evt => {
                      const target = evt.target
                      setManualData(prev => ({ ...prev, type: target.value }))
                    }}
                  />
                </div>
                <Input
                  inputType="number"
                  name="manualPrice"
                  shading={true}
                  label={t("priceLabel")}
                  value={manualData.price}
                  inputRef={manualPriceInputRef}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    setManualData(prev => ({ ...prev, price: target.value }))
                  }}
                  className="mt-4 w-full"
                  placeholder={t("pricePlaceholder")}
                />
                <Input
                  inputType="text"
                  name="manualPlaceOfPurchase"
                  label={t("placeOfPurchase")}
                  value={manualData.placeOfPurchase}
                  inputRef={manualPlaceInputRef}
                  shading={true}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    setManualData(prev => ({
                      ...prev,
                      placeOfPurchase: target.value,
                    }))
                  }}
                  className="mt-4 w-full"
                  placeholder={t("placeOfPurchasePlaceholder")}
                />
                {manualError && (
                  <p className="mt-4 text-sm text-red-400" role="alert">
                    {manualError}
                  </p>
                )}
                <Button type="submit" className="mt-4" disabled={manualSubmitting}>
                  {manualSubmitting ? "Submitting..." : "Add and submit for review"}
                </Button>
              </form>
            )}
          </>
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
                  size="compact"
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
