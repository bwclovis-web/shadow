"use client"

import type { DecantFormat, ListingCondition } from "@prisma/client"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef } from "react"

import { Button } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import RadioSelect from "@/components/Atoms/RadioSelect"
import Select from "@/components/Atoms/Select"
import RangeSlider from "@/components/Atoms/RangeSlider"
import ImageUploader from "@/components/Molecules/ImageUploader/ImageUploader"
import { useFormState } from "@/hooks/useFormState"
import { usePourableMlBudget } from "@/hooks/usePourableMlBudget"
import {
  budgetStatusFromPayload,
  computeFormMaxAvailableMl,
  currentListedFromRow,
  formatMlDisplay,
  validateDestashAmountAgainstBudget,
} from "@/lib/destash-form-budget"
import { CLEAN_DESTASH_LISTING_FIELDS } from "@/lib/destash-form-payload"
import { DECANT_FORMATS, LISTING_CONDITIONS } from "@/utils/listing-display"
import type { UserPerfumeI } from "@/types"

/** Mirrors server default: photos required unless explicitly disabled. */
const photosRequiredForPublish =
  process.env.NEXT_PUBLIC_LISTING_REQUIRE_PHOTO !== "false"

interface DeStashFormProps {
  perfumeId: string
  handleDecantConfirm: (deStashData: DeStashData) => void | Promise<void>
  userPerfume: UserPerfumeI
  isEditing?: boolean
  isCreating?: boolean
  isSubmitting?: boolean
  /** Explicit pause (edit only); uses existing pause API, not volume-zero submit. */
  onPause?: () => void | Promise<void>
  isPausing?: boolean
}

export interface DeStashData {
  amount: string
  /** Empty string = clear stored price on submit. */
  price: string
  tradePreference: "cash" | "trade" | "both"
  tradeOnly: boolean
  createNew?: boolean
  images: string[]
  condition: ListingCondition | null
  decantFormat: DecantFormat | null
}

const TRADE_OPTIONS = [
  {
    id: "cash",
    value: "cash",
    label: "decantOptionsTradePreferencesCash",
    name: "tradePreference",
  },
  {
    id: "trade",
    value: "trade",
    label: "decantOptionsTradePreferencesTrade",
    name: "tradePreference",
  },
  {
    id: "both",
    value: "both",
    label: "decantOptionsTradePreferencesBoth",
    name: "tradePreference",
  },
] as const

const DeStashForm = ({
  perfumeId,
  handleDecantConfirm,
  userPerfume,
  isEditing = false,
  isCreating = false,
  isSubmitting = false,
  onPause,
  isPausing = false,
}: DeStashFormProps) => {
  const t = useTranslations("myScents.listItem")
  const tDestash = useTranslations("myScents.destashManager")
  const tListing = useTranslations("listing")
  const tDisclaimer = useTranslations("decantSplits.wizard")

  const amountErrorRef = useRef<HTMLParagraphElement>(null)
  const formErrorRef = useRef<HTMLParagraphElement>(null)
  const budgetErrorRef = useRef<HTMLDivElement>(null)

  const {
    budget,
    loading: budgetLoading,
    error: budgetFetchError,
    refresh: refreshBudget,
  } = usePourableMlBudget(perfumeId)

  const budgetStatus = budgetLoading
    ? "loading"
    : budgetStatusFromPayload(budget, budgetFetchError)

  const currentListedMl = currentListedFromRow(
    isEditing ? userPerfume?.available : "0"
  )

  const maxAvailableMl = computeFormMaxAvailableMl({
    budget,
    isEditing,
    currentListedMl,
  })

  const initialValues = useMemo(() => {
    if (isCreating) {
      return {
        deStashAmount: "0",
        price: "",
        tradePreference: CLEAN_DESTASH_LISTING_FIELDS.tradePreference,
        tradeOnly: CLEAN_DESTASH_LISTING_FIELDS.tradeOnly,
        createNew: true,
        images: [] as string[],
        condition: null as ListingCondition | null,
        decantFormat: null as DecantFormat | null,
        disclaimerAccepted: false,
      }
    }

    return {
      deStashAmount: userPerfume?.available || "0",
      price: userPerfume?.tradePrice ?? "",
      tradePreference:
        (userPerfume?.tradePreference as "cash" | "trade" | "both") || "cash",
      tradeOnly: userPerfume?.tradeOnly || false,
      createNew: false,
      images: userPerfume?.images ?? [],
      condition: (userPerfume?.condition as ListingCondition | null) ?? null,
      decantFormat: (userPerfume?.decantFormat as DecantFormat | null) ?? null,
      disclaimerAccepted: false,
    }
  }, [
    isCreating,
    userPerfume?.available,
    userPerfume?.tradePrice,
    userPerfume?.tradePreference,
    userPerfume?.tradeOnly,
    userPerfume?.images,
    userPerfume?.condition,
    userPerfume?.decantFormat,
  ])

  const amountErrorMessage = useCallback(
    (reason: string, maxMl: number | null) => {
      switch (reason) {
        case "budget_loading":
          return tDestash("budgetLoading")
        case "budget_error":
        case "budget_unavailable":
          return tDestash("budgetUnavailable")
        case "ownership_unknown":
          return tDestash("budgetUnknownOwned")
        case "no_owned_volume":
          return tDestash("budgetNoOwned")
        case "positive_required":
          return tDestash("positiveVolumeRequired")
        case "invalid_volume":
          return t("decantOptionsAmountError")
        case "exceeds_available":
          return t("decantOptionsExceedsOwned", {
            owned: maxMl != null ? formatMlDisplay(maxMl) : "0.0",
          })
        case "availability_changed":
          return tDestash("availabilityChanged")
        default:
          return t("decantOptionsAmountError")
      }
    },
    [t, tDestash]
  )

  const validate = useCallback(
    (values: typeof initialValues) => {
      const errors: Partial<Record<keyof typeof values, string>> = {}

      const amountCheck = validateDestashAmountAgainstBudget({
        amountRaw: values.deStashAmount,
        maxAvailableMl,
        budgetStatus,
        isCreating,
        requirePositiveForCreate: true,
      })
      if (!amountCheck.ok) {
        errors.deStashAmount = amountErrorMessage(
          amountCheck.reason,
          maxAvailableMl
        )
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

      if (
        photosRequiredForPublish &&
        !isNaN(listingMl) &&
        listingMl > 0 &&
        values.images.length === 0
      ) {
        errors.images = tListing("errors.photoRequired")
      }

      return errors
    },
    [
      amountErrorMessage,
      budgetStatus,
      isCreating,
      maxAvailableMl,
      t,
      tDisclaimer,
      tListing,
    ]
  )

  const setErrorRef = useRef<
    ((field: "deStashAmount" | "images" | "price" | "disclaimerAccepted", error: string) => void) | null
  >(null)

  const onSubmit = useCallback(
    async (values: typeof initialValues) => {
      if (isSubmitting || isPausing) return

      // Revalidate budget so we do not submit against a stale max.
      const { budget: fresh, error: refreshFailed } = await refreshBudget()
      const freshStatus = refreshFailed
        ? "error"
        : budgetStatusFromPayload(fresh, false)
      const freshMax = computeFormMaxAvailableMl({
        budget: fresh,
        isEditing,
        currentListedMl,
      })

      const amountCheck = validateDestashAmountAgainstBudget({
        amountRaw: values.deStashAmount,
        maxAvailableMl: freshMax,
        budgetStatus: freshStatus,
        isCreating,
        requirePositiveForCreate: true,
      })

      if (!amountCheck.ok) {
        setErrorRef.current?.(
          "deStashAmount",
          amountErrorMessage(
            amountCheck.reason === "exceeds_available"
              ? "availability_changed"
              : amountCheck.reason,
            freshMax
          )
        )
        requestAnimationFrame(() => amountErrorRef.current?.focus())
        return
      }

      if (
        photosRequiredForPublish &&
        amountCheck.ml > 0 &&
        values.images.length === 0
      ) {
        setErrorRef.current?.("images", tListing("errors.photoRequired"))
        return
      }

      const tradeOnly = values.tradePreference === "trade"
      await handleDecantConfirm({
        amount: values.deStashAmount,
        price: values.price,
        tradePreference: values.tradePreference,
        tradeOnly,
        createNew: values.createNew,
        images: values.images,
        condition: values.condition,
        decantFormat: values.decantFormat,
      })
    },
    [
      amountErrorMessage,
      currentListedMl,
      handleDecantConfirm,
      isCreating,
      isEditing,
      isPausing,
      isSubmitting,
      refreshBudget,
      tListing,
    ]
  )

  const { values, errors, isValid, setValue, setError, handleSubmit } =
    useFormState({
      initialValues,
      validate,
      onSubmit,
      resetOnSubmit: false,
    })

  useEffect(() => {
    setErrorRef.current = setError
  }, [setError])

  useEffect(() => {
    if (errors.deStashAmount) {
      amountErrorRef.current?.focus()
      return
    }
    if (errors.images || errors.disclaimerAccepted || errors.price) {
      formErrorRef.current?.focus()
    }
  }, [errors])

  const deStashAmount = parseFloat(values.deStashAmount) || 0
  const showPriceAndTrade = deStashAmount > 0

  // Never fall back to an arbitrary 100 ml cap.
  const sliderMax =
    maxAvailableMl != null
      ? Math.max(0, maxAvailableMl)
      : Math.max(deStashAmount, 0)

  const sliderDisabled =
    budgetStatus === "loading" ||
    budgetStatus === "error" ||
    (budgetStatus === "unknown" && isCreating) ||
    (budgetStatus === "none" && isCreating) ||
    (maxAvailableMl != null && maxAvailableMl <= 0 && isCreating)

  const canSubmitPositive =
    budgetStatus === "ready" &&
    maxAvailableMl != null &&
    maxAvailableMl > 0

  const submitDisabled =
    isSubmitting ||
    isPausing ||
    budgetStatus === "loading" ||
    budgetStatus === "error" ||
    (isCreating && !canSubmitPositive) ||
    (isCreating && deStashAmount <= 0) ||
    !isValid ||
    deStashAmount < 0 ||
    (showPriceAndTrade && !values.disclaimerAccepted) ||
    (showPriceAndTrade &&
      photosRequiredForPublish &&
      values.images.length === 0)

  const buttonText = isEditing
    ? t("destashManager.saveChanges")
    : t("destashManager.createDestash")

  const showPause =
    isEditing &&
    typeof onPause === "function" &&
    currentListedMl > 0

  const tradeOptions = useMemo(
    () =>
      TRADE_OPTIONS.map(option => ({
        ...option,
        label: t(option.label),
        defaultChecked: option.value === values.tradePreference,
      })),
    [t, values.tradePreference]
  )

  const conditionSelectData = useMemo(
    () => [
      { id: "", name: "condition", label: tListing("conditionPlaceholder") },
      ...LISTING_CONDITIONS.map(option => ({
        id: option,
        name: "condition",
        label: tListing(`condition.${option}`),
      })),
    ],
    [tListing]
  )

  const decantFormatSelectData = useMemo(
    () => [
      {
        id: "",
        name: "decantFormat",
        label: tListing("decantFormatPlaceholder"),
      },
      ...DECANT_FORMATS.map(option => ({
        id: option,
        name: "decantFormat",
        label: tListing(`decantFormat.${option}`),
      })),
    ],
    [tListing]
  )

  return (
    <div className="p-4">
      <div
        className="mb-4 rounded border border-noir-gold/25 bg-noir-black/40 px-3 py-2 text-sm text-noir-gold-100"
        aria-live="polite"
      >
        {budgetStatus === "loading" && (
          <p className="m-0">{tDestash("budgetLoading")}</p>
        )}
        {budgetStatus === "error" && (
          <div ref={budgetErrorRef} tabIndex={-1} className="space-y-2">
            <p className="m-0 text-red-400" role="alert">
              {tDestash("budgetLoadFailed")}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void refreshBudget()}
            >
              {tDestash("budgetRetry")}
            </Button>
          </div>
        )}
        {budgetStatus === "unknown" && (
          <p className="m-0 text-amber-200/90" role="status">
            {tDestash("budgetUnknownOwned")}
          </p>
        )}
        {budgetStatus === "none" && (
          <p className="m-0 text-amber-200/90" role="status">
            {tDestash("budgetNoOwned")}
          </p>
        )}
        {budget &&
          (budgetStatus === "ready" ||
            (isEditing &&
              (budgetStatus === "unknown" || budgetStatus === "none"))) && (
            <p className="m-0 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                {tDestash("budgetOwned", {
                  ml: formatMlDisplay(budget.ownedMl),
                })}
              </span>
              <span>
                {tDestash("budgetListed", {
                  ml: formatMlDisplay(budget.listedMl),
                })}
              </span>
              <span>
                {tDestash("budgetReserved", {
                  ml: formatMlDisplay(budget.reservedMl),
                })}
              </span>
              <span className="font-medium text-noir-gold">
                {tDestash("budgetAvailable", {
                  ml:
                    maxAvailableMl != null
                      ? formatMlDisplay(maxAvailableMl)
                      : formatMlDisplay(budget.remainingPourableMl),
                })}
              </span>
              {budget.consumedCompletedMl > 0 && (
                <span className="text-noir-gold-500">
                  {tDestash("budgetCompletedPours", {
                    ml: formatMlDisplay(budget.consumedCompletedMl),
                  })}
                </span>
              )}
            </p>
          )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <RangeSlider
            min={0}
            max={sliderMax}
            step={0.1}
            value={Math.min(deStashAmount, sliderMax || deStashAmount)}
            onChange={value => {
              if (sliderDisabled) return
              setValue("deStashAmount", value.toFixed(1))
            }}
            formatValue={value => value.toFixed(1)}
            label={t("decantOptionsAmountLabel")}
            showManualInput={!sliderDisabled}
            inputPlaceholder={t("decantOptionsAmountPlaceholder", {
              amount:
                maxAvailableMl != null
                  ? formatMlDisplay(maxAvailableMl)
                  : "0.0",
            })}
          />
          {errors.deStashAmount && (
            <p
              ref={amountErrorRef}
              tabIndex={-1}
              className="text-red-500 text-sm mt-1 outline-none"
              role="alert"
            >
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
              <p className="text-xs text-noir-gold-500 mb-2">
                {tListing("photosHint")}
              </p>
              {photosRequiredForPublish && (
                <p className="text-xs text-noir-gold-100 mb-2" role="note">
                  {tDestash("photoRequiredBeforeSubmit")}
                </p>
              )}
              <ImageUploader
                value={values.images}
                onChange={urls => setValue("images", urls)}
                label={tListing("photosLabel")}
              />
              {errors.images && (
                <p
                  ref={formErrorRef}
                  tabIndex={-1}
                  className="text-red-500 text-sm mt-1 outline-none"
                  role="alert"
                >
                  {errors.images}
                </p>
              )}
            </div>
            <div className="flex flex-col md:flex-row gap-2 items-center justify-between my-6">
              <Select
                selectId="condition"
                className="w-full"
                selectData={conditionSelectData}
                label={tListing("conditionLabel")}
                value={values.condition ?? ""}
                action={event =>
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
                action={event =>
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
                <p className="text-red-500 text-sm mt-1" role="alert">
                  {errors.price}
                </p>
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
                    const newPreference = event.target.value as
                      | "cash"
                      | "trade"
                      | "both"
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
              <p className="text-red-500 text-sm" role="alert">
                {errors.disclaimerAccepted}
              </p>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Button type="submit" disabled={submitDisabled} variant="primary">
            {isSubmitting ? tDestash("saving") : buttonText}
          </Button>
          {showPause && (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting || isPausing}
              onClick={() => void onPause?.()}
            >
              {isPausing ? tDestash("pausing") : tDestash("pauseListing")}
            </Button>
          )}
          {(isSubmitting || isPausing) && (
            <span className="text-sm text-noir-gold-500" aria-live="polite">
              {isPausing ? tDestash("pausing") : tDestash("saving")}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

export default DeStashForm
