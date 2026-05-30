import type { DecantFormat, ListingCondition } from "@prisma/client"
import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"

import { Button } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import RadioSelect from "@/components/Atoms/RadioSelect"
import Select from "@/components/Atoms/Select"
import RangeSlider from "@/components/Atoms/RangeSlider"
import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import ImageUploader from "@/components/Molecules/ImageUploader/ImageUploader"
import { useFormState } from "@/hooks/useFormState"
import { DECANT_FORMATS, LISTING_CONDITIONS } from "@/utils/listing-display"
import type { UserPerfumeI } from "@/types"

interface DeStashFormProps {
  handleDecantConfirm: (deStashData: DeStashData) => void
  userPerfume: UserPerfumeI
  isEditing?: boolean
  isCreating?: boolean
  maxAvailable?: number // Maximum amount that can be destashed (remaining from owned)
}

export interface DeStashData {
  amount: string
  price?: string
  tradePreference: "cash" | "trade" | "both"
  tradeOnly: boolean
  createNew?: boolean
  images: string[]
  condition: ListingCondition | null
  decantFormat: DecantFormat | null
}

const TRADE_OPTIONS = [
  { id: "cash", value: "cash", label: "decantOptionsTradePreferencesCash", name: "tradePreference" },
  { id: "trade", value: "trade", label: "decantOptionsTradePreferencesTrade", name: "tradePreference" },
  { id: "both", value: "both", label: "decantOptionsTradePreferencesBoth", name: "tradePreference" },
] as const

const DeStashForm = ({
  handleDecantConfirm,
  userPerfume,
  isEditing = false,
  isCreating = false,
  maxAvailable,
}: DeStashFormProps) => {
  const t = useTranslations("myScents.listItem")
  const tListing = useTranslations("listing")
  const tDisclaimer = useTranslations("decantSplits.wizard")
  const available = userPerfume?.available || "0"
  const tradePriceVal = userPerfume?.tradePrice || ""
  const tradePreferenceVal =
    (userPerfume?.tradePreference as "cash" | "trade" | "both") || "cash"
  const tradeOnlyVal = userPerfume?.tradeOnly || false

  const initialValues = useMemo(
    () => ({
      deStashAmount: isCreating ? "0" : available,
      price: tradePriceVal,
      tradePreference: tradePreferenceVal,
      tradeOnly: tradeOnlyVal,
      createNew: isCreating,
      images: userPerfume?.images ?? [],
      condition: (userPerfume?.condition as ListingCondition | null) ?? null,
      decantFormat: (userPerfume?.decantFormat as DecantFormat | null) ?? null,
      disclaimerAccepted: false,
    }),
    [
      available,
      tradePriceVal,
      tradePreferenceVal,
      tradeOnlyVal,
      isCreating,
      userPerfume?.images,
      userPerfume?.condition,
      userPerfume?.decantFormat,
    ]
  )

  const validate = useCallback(
    (values: typeof initialValues) => {
      const errors: Partial<Record<keyof typeof values, string>> = {}

      const amount = parseFloat(values.deStashAmount)
      if (isNaN(amount) || amount < 0) {
        errors.deStashAmount = t("decantOptionsAmountError")
      }

      if (!isNaN(amount) && maxAvailable !== undefined && amount > maxAvailable) {
        errors.deStashAmount = t("decantOptionsExceedsOwned", {
          owned: maxAvailable.toFixed(1),
        })
      }

      if (values.price && values.price !== "") {
        const price = parseFloat(values.price)
        if (isNaN(price) || price < 0) {
          errors.price = t("decantOptionsPriceError")
        }
      }

      const listingMl = parseFloat(values.deStashAmount)
      if (!isNaN(listingMl) && listingMl > 0 && !values.disclaimerAccepted) {
        errors.disclaimerAccepted = tDisclaimer("disclaimerRequired")
      }

      return errors
    },
    [maxAvailable, t, tDisclaimer]
  )

  const onSubmit = useCallback(
    (values: typeof initialValues) => {
      const tradeOnly = values.tradePreference === "trade"
      
      const deStashData: DeStashData = {
        amount: values.deStashAmount,
        price: values.price || undefined,
        tradePreference: values.tradePreference,
        tradeOnly,
        createNew: values.createNew,
        images: values.images,
        condition: values.condition,
        decantFormat: values.decantFormat,
      }
      handleDecantConfirm(deStashData)
    },
    [handleDecantConfirm]
  )

  const { values, errors, isValid, setValue, handleSubmit } = useFormState({
    initialValues,
    validate,
    onSubmit,
    resetOnSubmit: false,
  })

  const isNewDecant = isCreating || values.createNew
  const maxAmount = maxAvailable !== undefined
    ? Math.max(0, maxAvailable)
    : 100
  const deStashAmount = parseFloat(values.deStashAmount) || 0
  const showPriceAndTrade = deStashAmount > 0
  const isFormMode = !isEditing && !isCreating

  const buttonText = isEditing
    ? t("destashManager.saveChanges")
    : isCreating
      ? t("destashManager.createDestash")
      : deStashAmount === 0
        ? t("removeFromTradingPost")
        : t("confirmDeStash")

  const tradeOptions = useMemo(
    () => TRADE_OPTIONS.map(option => ({
      ...option,
      label: t(option.label),
      defaultChecked: option.value === values.tradePreference,
    })),
    [t, values.tradePreference]
  )

  const conditionSelectData = useMemo(
    () => [
      { id: "", name: "condition", label: tListing("conditionPlaceholder") },
      ...LISTING_CONDITIONS.map((option) => ({
        id: option,
        name: "condition",
        label: tListing(`condition.${option}`),
      })),
    ],
    [tListing]
  )

  const decantFormatSelectData = useMemo(
    () => [
      { id: "", name: "decantFormat", label: tListing("decantFormatPlaceholder") },
      ...DECANT_FORMATS.map((option) => ({
        id: option,
        name: "decantFormat",
        label: tListing(`decantFormat.${option}`),
      })),
    ],
    [tListing]
  )

  return (
    <div className="p-4">
      {isFormMode && (
        <>
          <h3>
            {t("decantOptionsTitle")}
          </h3>
          <p className="text-sm text-noir-gold-500">
            {t("decantOptionsDescriptionOne")}
          </p>
          <p className="text-sm text-noir-gold-500">
            {t("decantOptionsDescriptionTwo")}
          </p>
        </>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {isFormMode && (
          <div className="mb-4">
            <VooDooCheck
              labelChecked={t("createNewDecant")}
              labelUnchecked={t("updateExistingDecant")}
              checked={values.createNew}
              onChange={() => setValue("createNew", !values.createNew)}
            />
            {values.createNew && (
              <p className="text-sm text-noir-gold-500 mt-2">
                {t("createNewDecantDescription")}
              </p>
            )}
          </div>
        )}

        <div>
          <RangeSlider
            min={0}
            max={maxAmount}
            step={0.1}
            value={deStashAmount}
            onChange={value => setValue("deStashAmount", value.toFixed(1))}
            formatValue={value => value.toFixed(1)}
            label={t("decantOptionsAmountLabel")}
            showManualInput={true}
            inputPlaceholder={t("decantOptionsAmountPlaceholder", {
              amount: isNewDecant ? "100" : (userPerfume?.amount || "0"),
            })}
          />
          {errors.deStashAmount && (
            <p className="text-red-500 text-sm mt-1">
              {errors.deStashAmount}
            </p>
          )}
        </div>

        {showPriceAndTrade && (
          <>
            <div>
              <p className="block text-sm font-medium text-noir-gold-100 mb-1">
                {tListing("photosLabel")}
              </p>
              <p className="text-xs text-noir-gold-500 mb-2">{tListing("photosHint")}</p>
              <ImageUploader
                value={values.images}
                onChange={(urls) => setValue("images", urls)}
                label={tListing("photosLabel")}
              />
            </div>
            <div className="flex flex-col md:flex-row gap-2 items-center justify-between my-6">
            <Select
              selectId="condition"
              className="w-full"
              selectData={conditionSelectData}
              label={tListing("conditionLabel")}
              value={values.condition ?? ""}
              action={(event) =>
                setValue(
                  "condition",
                  (event.target.value || null) as ListingCondition | null
                )
              }
            />
            <Select
              selectId="decantFormat"
              selectData={decantFormatSelectData}
              label={tListing("decantFormatLabel")}
              value={values.decantFormat ?? ""}
              action={(event) =>
                setValue(
                  "decantFormat",
                  (event.target.value || null) as DecantFormat | null
                )
              }
            />
              <Input
                inputType="number"
                inputId="price"
                name="price"
                label={t("decantOptionsPriceLabel")}
                placeholder="0.00"
                value={values.price}
                shading
                step="0.01"
                min="0"
                onChange={event => setValue("price", event.target.value)}
              />
              {errors.price && (
                <p className="text-red-500 text-sm mt-1">{errors.price}</p>
              )}
            </div>
            <div>
              <fieldset>
                <legend className="block text-sm font-medium text-noir-gold-100 mb-2">
                  {t("decantOptionsTradePreferencesLabel")}
                </legend>
                <RadioSelect
                  data={tradeOptions}
                  handleRadioChange={event => {
                    const newPreference = event.target.value as "cash" | "trade" | "both"
                    setValue("tradePreference", newPreference)
                    setValue("tradeOnly", newPreference === "trade")
                  }}
                />
              </fieldset>
            </div>
            <label className="flex items-start gap-2 text-sm text-noir-gold-100">
              <input
                type="checkbox"
                checked={values.disclaimerAccepted}
                onChange={event =>
                  setValue("disclaimerAccepted", event.target.checked)
                }
                className="mt-1"
              />
              <span>{tDisclaimer("disclaimer")}</span>
            </label>
            {errors.disclaimerAccepted && (
              <p className="text-red-500 text-sm">{errors.disclaimerAccepted}</p>
            )}
          </>
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={
              !isValid ||
              deStashAmount < 0 ||
              (showPriceAndTrade && !values.disclaimerAccepted)
            }
            variant="primary"
          >
            {buttonText}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default DeStashForm
