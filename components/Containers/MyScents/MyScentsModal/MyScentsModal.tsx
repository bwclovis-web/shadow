"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { MdInfoOutline } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import RangeSlider from "@/components/Atoms/RangeSlider"
import Select from "@/components/Atoms/Select"
import ValidationMessage from "@/components/Atoms/ValidationMessage/ValidationMessage"
import { HouseAutocomplete, type HouseAutocompleteOption } from "@/components/Molecules/HouseAutocomplete"
import IconPopover from "@/components/Molecules/IconPopover"
import SearchBar from "@/components/Organisms/SearchBar"
import { perfumeTypes } from "@/data/SelectTypes"
import { useCSRF } from "@/hooks/useCSRF"
import {
  useMyScentsForm,
  type OptimisticCollectionItem,
} from "@/hooks/useMyScentsForm"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"
import {
  mapFormApiIssuesToFields,
  parseFormApiError,
} from "@/utils/parse-form-api-error"
import { getTranslatedError, validationKeys } from "@/utils/validation/validationKeys"
import { styleMerge } from "@/utils/styleUtils"

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

type ManualFieldName =
  | "perfumeName"
  | "house"
  | "customHouseName"
  | "amount"
  | "type"
  | "price"
  | "placeOfPurchase"

const MANUAL_ISSUE_FIELD_MAP = {
  perfumeName: "perfumeName",
  existingHouseId: "house",
  customHouseName: "customHouseName",
  amount: "amount",
  type: "type",
  price: "price",
  placeOfPurchase: "placeOfPurchase",
} as const satisfies Record<string, ManualFieldName>

const MANUAL_FIELD_FOCUS_IDS: Record<ManualFieldName, string> = {
  perfumeName: "manual-perfume-name",
  house: "manual-house",
  customHouseName: "manual-custom-house-name",
  amount: "manual-amount",
  type: "manual-type",
  price: "manual-price",
  placeOfPurchase: "manual-place-of-purchase",
}

const getManualFieldsInOrder = (useCustomHouse: boolean): ManualFieldName[] =>
  useCustomHouse
    ? ["perfumeName", "customHouseName", "amount", "type", "price", "placeOfPurchase"]
    : ["perfumeName", "house", "amount", "type", "price", "placeOfPurchase"]

const focusFieldById = (elementId: string) => {
  const element = document.getElementById(elementId)
  if (element && "focus" in element && typeof element.focus === "function") {
    element.focus({ preventScroll: false })
  }
}

const focusFirstManualFieldError = (
  fieldErrors: Partial<Record<ManualFieldName, string>>,
  useCustomHouse: boolean
) => {
  const firstField = getManualFieldsInOrder(useCustomHouse).find(field => fieldErrors[field])
  if (!firstField) {
    return
  }
  focusFieldById(MANUAL_FIELD_FOCUS_IDS[firstField])
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
  const tValidation = useTranslations()
  const { submitForm } = useCSRF()

  const translateError = useCallback(
    (message: string | null | undefined) =>
      message ? getTranslatedError(message, tValidation) ?? message : undefined,
    [tValidation]
  )

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
  const [manualFieldErrors, setManualFieldErrors] = useState<
    Partial<Record<ManualFieldName, string>>
  >({})
  const [manualSubmitting, setManualSubmitting] = useState(false)

  const clearManualErrors = useCallback(() => {
    setManualError(null)
    setManualFieldErrors({})
  }, [])

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
    submitError,
    isSubmitting,
    clearSubmitError,
  } = useMyScentsForm(
    perfume,
    handleAddSuccess,
    {
      onOptimisticAdd: onOptimisticAddToCollection,
      onOptimisticAddRollback,
    },
    {
      submitError: t("submitError"),
      networkError: t("networkError"),
    }
  )

  const handleManualAdd = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      clearManualErrors()

      if (!allowCustomHouse && !manualHouse?.id) {
        const houseMessage =
          getTranslatedError(validationKeys.perfumeHouseRequired, tValidation) ??
          validationKeys.perfumeHouseRequired
        setManualFieldErrors({ house: houseMessage })
        setManualError(houseMessage)
        return
      }

      setManualSubmitting(true)

      try {
        const formData = new FormData()
        formData.set("perfumeName", manualData.perfumeName.trim())
        if (allowCustomHouse) {
          formData.set("customHouseName", manualData.customHouseName.trim())
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
          formData.set("placeOfPurchase", manualData.placeOfPurchase.trim())
        }

        const response = await submitForm("/api/user-perfumes/manual-entry", formData)
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data?.success) {
          const fieldErrors = mapFormApiIssuesToFields(
            data?.issues,
            MANUAL_ISSUE_FIELD_MAP
          )
          if (Object.keys(fieldErrors).length > 0) {
            setManualFieldErrors(fieldErrors)
          }

          setManualError(
            translateError(parseFormApiError(data, t("submitError"))) ?? t("submitError")
          )
          return
        }

        closeModal()
        onAddedToCollection?.()
      } catch {
        setManualError(t("networkError"))
      } finally {
        setManualSubmitting(false)
      }
    },
    [
      allowCustomHouse,
      clearManualErrors,
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
      t,
      tValidation,
      translateError,
    ]
  )

  const clearManualFieldError = useCallback((field: ManualFieldName) => {
    setManualFieldErrors(prev => {
      if (!prev[field]) {
        return prev
      }
      const next = { ...prev }
      delete next[field]
      return next
    })
    setManualError(null)
  }, [])

  useEffect(() => {
    if (Object.keys(manualFieldErrors).length === 0) {
      return
    }
    focusFirstManualFieldError(manualFieldErrors, allowCustomHouse)
  }, [manualFieldErrors, allowCustomHouse])

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
                        className="w-full rounded px-2 py-1 text-left text-sm text-noir-gold-100 hover:bg-noir-gold/50 hover:text-noir-black cursor-pointer"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => {
                          clearManualErrors()
                          setManualMode(true)
                        }}
                      >
                        {t("addManuallyLink")}
                      </button>
                    </li>
                  }
                />
              </>
            )}
            {manualMode && (
              <form
                onSubmit={handleManualAdd}
                className="mt-4 w-full rounded-md border border-noir-gold/30 bg-noir-black/20 p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-noir-gold-100">
                    {t("manualEntryDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      clearManualErrors()
                      setManualMode(false)
                    }}
                  >
                    {t("backToSearch")}
                  </Button>
                </div>
                <Input
                  inputType="text"
                  name="manualPerfumeName"
                  inputId="manual-perfume-name"
                  label={t("fragranceNameLabel")}
                  value={manualData.perfumeName}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    clearManualFieldError("perfumeName")
                    setManualData(prev => ({ ...prev, perfumeName: target.value }))
                  }}
                  className="w-full"
                  placeholder={t("fragranceNamePlaceholder")}
                  required
                  shading
                />
                {manualFieldErrors.perfumeName && (
                  <p className="mt-1 text-sm text-red-400" role="alert">
                    {translateError(manualFieldErrors.perfumeName)}
                  </p>
                )}
                {!allowCustomHouse && (
                  <>
                    <HouseAutocomplete
                      selected={manualHouse}
                      onSelect={house => {
                        clearManualFieldError("house")
                        setManualHouse(house)
                      }}
                      inputId="manual-house"
                      label={t("fragranceHouseLabel")}
                      clearLabel={t("houseClearLabel")}
                      className="mt-4"
                    />
                    {manualFieldErrors.house && (
                      <p className="mt-1 text-sm text-red-400" role="alert">
                        {translateError(manualFieldErrors.house)}
                      </p>
                    )}
                  </>
                )}
                <div className="mt-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-noir-gold-100">
                    <input
                      type="checkbox"
                      checked={allowCustomHouse}
                      onChange={event => {
                        const checked = event.target.checked
                        clearManualErrors()
                        setAllowCustomHouse(checked)
                        if (checked) setManualHouse(null)
                      }}
                    />
                    {t("houseNotListed")}
                  </label>
                </div>
                {allowCustomHouse && (
                  <Input
                    inputType="text"
                    name="manualCustomHouseName"
                    inputId="manual-custom-house-name"
                    label={t("customHouseNameLabel")}
                    value={manualData.customHouseName}
                    onChange={event => {
                      const target = event.target as HTMLInputElement
                      clearManualFieldError("customHouseName")
                      setManualData(prev => ({
                        ...prev,
                        customHouseName: target.value,
                      }))
                    }}
                    className="mt-4 w-full"
                    placeholder={t("customHouseNamePlaceholder")}
                    required
                    shading
                  />
                )}
                {manualFieldErrors.customHouseName && (
                  <p className="mt-1 text-sm text-red-400" role="alert">
                    {translateError(manualFieldErrors.customHouseName)}
                  </p>
                )}
                <fieldset className="mt-4">
                  <legend className="text-sm font-medium text-noir-gold-100">{t("priceAndPurchaseInfo")}</legend>
                  <p className="text-xs text-noir-gold-100">{t("priceAndPurchaseDescription")}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                
                  
                  <Input
                    inputType="text"
                    name="manualAmount"
                    inputId="manual-amount"
                    label={t("amountLabel")}
                    value={manualData.amount}
                    onChange={event => {
                      const target = event.target as HTMLInputElement
                      clearManualFieldError("amount")
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
                      clearManualFieldError("type")
                      setManualData(prev => ({ ...prev, type: target.value }))
                    }}
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input
                  inputType="number"
                  name="manualPrice"
                  inputId="manual-price"
                  shading={true}
                  label={t("priceLabel")}
                  value={manualData.price}
                  inputRef={manualPriceInputRef}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    clearManualFieldError("price")
                    setManualData(prev => ({ ...prev, price: target.value }))
                  }}
                  placeholder={t("pricePlaceholder")}
                />
                <Input
                  inputType="text"
                  name="manualPlaceOfPurchase"
                  inputId="manual-place-of-purchase"
                  label={t("placeOfPurchase")}
                  value={manualData.placeOfPurchase}
                  inputRef={manualPlaceInputRef}
                  shading={true}
                  onChange={event => {
                    const target = event.target as HTMLInputElement
                    clearManualFieldError("placeOfPurchase")
                    setManualData(prev => ({
                      ...prev,
                      placeOfPurchase: target.value,
                    }))
                  }}
                  placeholder={t("placeOfPurchasePlaceholder")}
                />
                </div>
                </fieldset>
                {manualError && (
                  <ValidationMessage
                    error={translateError(manualError)}
                    className="mt-4"
                    size="sm"
                  />
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={manualSubmitting}>
                    {manualSubmitting ? t("submitting") : t("manualSubmitButton")}
                  </Button>
                  <IconPopover
                    ariaLabel={t("manualReviewInfoAriaLabel")}
                    icon={<MdInfoOutline size={20} className="text-current" />}
                    buttonClassName={styleMerge(
                      "border border-noir-gold/35 text-noir-gold-400 hover:text-noir-gold-100 hover:border-noir-gold/55 rounded-full"
                    )}
                  >
                    <p className="text-sm text-noir-gold-100/90 leading-snug text-center px-1 m-0">
                      {t("manualReviewInfo")}
                    </p>
                  </IconPopover>
                </div>
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
                    clearSubmitError()
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
                    clearSubmitError()
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
                    clearSubmitError()
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
                    clearSubmitError()
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
          {submitError && (
            <ValidationMessage
              error={translateError(submitError)}
              className="mt-4"
              size="sm"
            />
          )}
          <Button type="submit" className="mt-6" disabled={isSubmitting}>
            {isSubmitting ? t("submitting") : t("submitButton")}
          </Button>
        </form>
      )}
    </div>
  )
}

export default MyScentsModal
