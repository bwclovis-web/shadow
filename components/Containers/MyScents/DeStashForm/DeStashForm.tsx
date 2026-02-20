import { t } from "i18next"
import { useCallback, useMemo } from "react"

import { Button } from "~/components/Atoms/Button"
import RadioSelect from "~/components/Atoms/RadioSelect"
import RangeSlider from "~/components/Atoms/RangeSlider"
import VooDooCheck from "~/components/Atoms/VooDooCheck/VooDooCheck"
import { useFormState } from "~/hooks"
import type { UserPerfumeI } from "~/types"

interface DeStashFormProps {
  handleDecantConfirm: (deStashData: DeStashData) => void
  userPerfume: UserPerfumeI
  isEditing?: boolean
  isCreating?: boolean
  maxAvailable?: number // Maximum amount that can be destashed (remaining from owned)
}

interface DeStashData {
  amount: string
  price?: string
  tradePreference: "cash" | "trade" | "both"
  tradeOnly: boolean
  createNew?: boolean
}

const TRADE_OPTIONS = [
  {
    id: "cash",
    value: "cash",
    label: "myScents.listItem.decantOptionsTradePreferencesCash",
    name: "tradePreference",
  },
  {
    id: "trade",
    value: "trade",
    label: "myScents.listItem.decantOptionsTradePreferencesTrade",
    name: "tradePreference",
  },
  {
    id: "both",
    value: "both",
    label: "myScents.listItem.decantOptionsTradePreferencesBoth",
    name: "tradePreference",
  },
] as const

const DeStashForm = ({
  handleDecantConfirm,
  userPerfume,
  isEditing = false,
  isCreating = false,
  maxAvailable,
}: DeStashFormProps) => {
  const initialValues = useMemo(
    () => {
      return {
        deStashAmount: isCreating ? "0" : (userPerfume?.available || "0"),
        price: userPerfume?.tradePrice || "",
        tradePreference:
          (userPerfume?.tradePreference as "cash" | "trade" | "both") || "cash",
        tradeOnly: userPerfume?.tradeOnly || false,
        createNew: isCreating,
      };
    },
    [
      userPerfume?.id || "",
      userPerfume?.available || "0",
      userPerfume?.tradePrice || "",
      userPerfume?.tradePreference || "cash",
      userPerfume?.tradeOnly || false,
      isCreating,
    ]
  )

  const validate = useCallback(
    (values: typeof initialValues) => {
      const errors: Partial<Record<keyof typeof values, string>> = {}

      const amount = parseFloat(values.deStashAmount)
      if (isNaN(amount) || amount < 0) {
        errors.deStashAmount = t("myScents.listItem.decantOptionsAmountError")
      }

      // Check that destash amount doesn't exceed max available
      if (!isNaN(amount) && maxAvailable !== undefined && amount > maxAvailable) {
        errors.deStashAmount = t(
          "myScents.listItem.decantOptionsExceedsOwned",
          { owned: maxAvailable.toFixed(1) }
        )
      }

      if (values.price && values.price !== "") {
        const price = parseFloat(values.price)
        if (isNaN(price) || price < 0) {
          errors.price = t("myScents.listItem.decantOptionsPriceError")
        }
      }

      return errors
    },
    [maxAvailable]
  )

  const onSubmit = useCallback(
    (values: typeof initialValues) => {
      // Set tradeOnly automatically based on tradePreference
      // If preference is "trade", then tradeOnly is true, otherwise false
      const tradeOnly = values.tradePreference === "trade"
      
      const deStashData: DeStashData = {
        amount: values.deStashAmount,
        price: values.price || undefined,
        tradePreference: values.tradePreference,
        tradeOnly,
        createNew: values.createNew,
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
  // Use maxAvailable if provided, otherwise fall back to owned amount or 100
  const maxAmount = maxAvailable !== undefined
    ? Math.max(0, maxAvailable)
    : 100
  const deStashAmount = parseFloat(values.deStashAmount) || 0
  const showPriceAndTrade = deStashAmount > 0
  const isFormMode = !isEditing && !isCreating

  const getButtonText = useCallback(() => {
    if (isEditing) {
      return t("myScents.destashManager.saveChanges")
    }
    if (isCreating) {
      return t("myScents.destashManager.createDestash")
    }
    if (deStashAmount === 0) {
      return t("myScents.listItem.removeFromTradingPost")
    }
    return t("myScents.listItem.confirmDeStash")
  }, [isEditing, isCreating, deStashAmount])

  const tradeOptions = useMemo(
    () => TRADE_OPTIONS.map(option => ({
      ...option,
      label: t(option.label),
      defaultChecked: option.value === values.tradePreference,
    })),
    [values.tradePreference]
  )

  const renderHeader = () => {
    if (!isFormMode) {
      return null
    }
    return (
      <>
        <h3 className="!text-noir-dark">
          {t("myScents.listItem.decantOptionsTitle")}
        </h3>
        <p className="text-sm text-noir-black">
          {t("myScents.listItem.decantOptionsDescriptionOne")}
        </p>
        <p className="text-sm text-noir-black">
          {t("myScents.listItem.decantOptionsDescriptionTwo")}
        </p>
      </>
    )
  }

  const renderCreateNewOption = () => {
    if (!isFormMode) {
      return null
    }
    return (
      <div className="mb-4">
        <VooDooCheck
          labelChecked={t("myScents.listItem.createNewDecant")}
          labelUnchecked={t("myScents.listItem.updateExistingDecant")}
          checked={values.createNew}
          onChange={() => setValue("createNew", !values.createNew)}
        />
        {values.createNew && (
          <p className="text-sm text-noir-gold-500 mt-2">
            {t("myScents.listItem.createNewDecantDescription")}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      {renderHeader()}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {renderCreateNewOption()}

        <div>
          <RangeSlider
            min={0}
            max={maxAmount}
            step={0.1}
            value={deStashAmount}
            onChange={value => setValue("deStashAmount", value.toFixed(1))}
            formatValue={value => value.toFixed(1)}
            label={t("myScents.listItem.decantOptionsAmountLabel")}
            showManualInput={true}
            inputPlaceholder={t("myScents.listItem.decantOptionsAmountPlaceholder", {
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
          <div>
            <label
              htmlFor="price"
              className="block text-sm font-medium text-noir-dark mb-1"
            >
              {t("myScents.listItem.decantOptionsPriceLabel")}
            </label>
            <input
              type="number"
              id="price"
              name="price"
              placeholder="0.00"
              value={values.price}
              onChange={event => setValue("price", event.target.value)}
              step="0.01"
              min="0"
              className="mt-1 px-2 py-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        )}

        {showPriceAndTrade && (
          <div>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">
                {t("myScents.listItem.decantOptionsTradePreferencesLabel")}
              </legend>
              <RadioSelect
                data={tradeOptions}
                handleRadioChange={event => {
                  const newPreference = event.target.value as "cash" | "trade" | "both"
                  setValue("tradePreference", newPreference)
                  // Automatically update tradeOnly based on selection
                  setValue("tradeOnly", newPreference === "trade")
                }}
              />
            </fieldset>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={!isValid || deStashAmount < 0}
            variant="primary"
          >
            {getButtonText()}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default DeStashForm
