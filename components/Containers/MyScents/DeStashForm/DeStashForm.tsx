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
import { parseMl } from "@/lib/user-inventory"
import { DECANT_FORMATS, LISTING_CONDITIONS } from "@/utils/listing-display"
import type { UserPerfumeI } from "@/types"

export type DeStashFormActionState = {
  submitDisabled: boolean
  showPause: boolean
  isDirty: boolean
}

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
  /**
   * `rail` — body fields only; actions live in the drawer footer via `formId`.
   * `page` — inline Cancel/Save/Pause (DestashManager / bottle page).
   */
  layout?: "page" | "rail"
  /** HTML form id for external submit buttons (`form={formId}`). */
  formId?: string
  /** Rail footer sync — same disable rules as inline actions. */
  onActionStateChange?: (state: DeStashFormActionState) => void
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
  layout = "page",
  formId,
  onActionStateChange,
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

  const editListedSource =
    isEditing && parseMl(userPerfume?.available) <= 0
      ? userPerfume?.pausedAvailable || userPerfume?.available || "0"
      : isEditing
        ? userPerfume?.available || "0"
        : "0"

  const currentListedMl = currentListedFromRow(isEditing ? editListedSource : "0")

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

    const seededAmount =
      parseMl(userPerfume?.available) > 0
        ? String(userPerfume?.available)
        : userPerfume?.pausedAvailable || userPerfume?.available || "0"

    return {
      deStashAmount: seededAmount,
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
    userPerfume?.pausedAvailable,
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

  const { values, errors, isValid, isDirty, setValue, setError, handleSubmit } =
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

  const isRail = layout === "rail"
  const deStashAmount = parseFloat(values.deStashAmount) || 0
  const showPriceAndTrade = deStashAmount > 0
  /** Rail keeps photos + listing fields visible while editing (mockup); create still gates on amount. */
  const showListingDetails = isRail
    ? isEditing || showPriceAndTrade
    : showPriceAndTrade

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

  useEffect(() => {
    if (!onActionStateChange) return
    onActionStateChange({ submitDisabled, showPause, isDirty })
  }, [onActionStateChange, submitDisabled, showPause, isDirty])

  const budgetReady =
    budget &&
    (budgetStatus === "ready" ||
      (isEditing && (budgetStatus === "unknown" || budgetStatus === "none")))

  const amountField = isRail ? (
    <div>
      <Input
        inputType="number"
        inputId="deStashAmount"
        name="deStashAmount"
        label={t("decantOptionsAmountLabel")}
        placeholder={t("decantOptionsAmountPlaceholder", {
          amount:
            maxAvailableMl != null ? formatMlDisplay(maxAvailableMl) : "0.0",
        })}
        value={values.deStashAmount}
        shading
        step="0.1"
        min="0"
        max={maxAvailableMl ?? undefined}
        disabled={sliderDisabled}
        onChange={event => setValue("deStashAmount", event.target.value)}
        className="w-full max-w-none"
      />
      {errors.deStashAmount && (
        <p
          ref={amountErrorRef}
          tabIndex={-1}
          className="mt-1 text-sm text-red-500 outline-none"
          role="alert"
        >
          {errors.deStashAmount}
        </p>
      )}
    </div>
  ) : (
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
            maxAvailableMl != null ? formatMlDisplay(maxAvailableMl) : "0.0",
        })}
      />
      {errors.deStashAmount && (
        <p
          ref={amountErrorRef}
          tabIndex={-1}
          className="mt-1 text-sm text-red-500 outline-none"
          role="alert"
        >
          {errors.deStashAmount}
        </p>
      )}
    </div>
  )

  const formatConditionFields = (
    <div
      className={
        isRail
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
          : "flex flex-col items-center justify-between gap-2 md:flex-row"
      }
    >
      <Select
        selectId="decantFormat"
        className="w-full max-w-none"
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
      <Select
        selectId="condition"
        className="w-full max-w-none"
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
    </div>
  )

  const tradeField = (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-noir-gold-100">
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
  )

  const priceField = (
    <div>
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
        className="w-full max-w-none"
      />
      {errors.price && (
        <p className="mt-1 text-sm text-red-500" role="alert">
          {errors.price}
        </p>
      )}
    </div>
  )

  const photosField = (
    <div>
      <p className="mb-1 block text-sm font-medium text-noir-gold-100">
        {tListing("photosLabel")}
      </p>
      <p className="mb-2 text-xs text-noir-gold-500">{tListing("photosHint")}</p>
      {photosRequiredForPublish && (
        <p className="mb-2 text-xs text-noir-gold-100" role="note">
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
          className="mt-1 text-sm text-red-500 outline-none"
          role="alert"
        >
          {errors.images}
        </p>
      )}
    </div>
  )

  const disclaimerField = (
    <>
      <label className="flex items-start gap-2 text-sm text-noir-gold-100">
        <input
          type="checkbox"
          checked={values.disclaimerAccepted}
          onChange={event => setValue("disclaimerAccepted", event.target.checked)}
          className="mt-1"
        />
        <span>{tDisclaimer("disclaimer")}</span>
      </label>
      {errors.disclaimerAccepted && (
        <p className="text-sm text-red-500" role="alert">
          {errors.disclaimerAccepted}
        </p>
      )}
    </>
  )

  return (
    <div className={isRail ? undefined : "p-4"}>
      <div
        className={
          isRail
            ? "mb-4 rounded border border-noir-gold/30 bg-noir-black/40 px-3 py-3 text-sm text-noir-gold-100"
            : "mb-4 rounded border border-noir-gold/25 bg-noir-black/40 px-3 py-2 text-sm text-noir-gold-100"
        }
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
        {budgetReady && budget && (
          isRail ? (
            <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <dt className="text-xs text-noir-gold-500">
                  {tDestash("budgetLabelOwned")}
                </dt>
                <dd className="m-0 font-medium text-noir-cream">
                  {formatMlDisplay(budget.ownedMl)} ml
                </dd>
              </div>
              <div>
                <dt className="text-xs text-noir-gold-500">
                  {tDestash("budgetLabelListed")}
                </dt>
                <dd className="m-0 font-medium text-noir-cream">
                  {formatMlDisplay(budget.listedMl)} ml
                </dd>
              </div>
              <div>
                <dt className="text-xs text-noir-gold-500">
                  {tDestash("budgetLabelReserved")}
                </dt>
                <dd className="m-0 font-medium text-noir-cream">
                  {formatMlDisplay(budget.reservedMl)} ml
                </dd>
              </div>
              <div>
                <dt className="text-xs text-noir-gold-500">
                  {tDestash("budgetLabelAvailable")}
                </dt>
                <dd className="m-0 font-medium text-noir-gold">
                  {maxAvailableMl != null
                    ? formatMlDisplay(maxAvailableMl)
                    : formatMlDisplay(budget.remainingPourableMl)}{" "}
                  ml
                </dd>
              </div>
            </dl>
          ) : (
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
          )
        )}
      </div>

      <form
        id={formId}
        onSubmit={handleSubmit}
        className={isRail ? "mt-2 space-y-4" : "mt-4 space-y-4"}
        noValidate
      >
        {amountField}

        {showListingDetails &&
          (isRail ? (
            <>
              {formatConditionFields}
              {tradeField}
              {priceField}
              {photosField}
              {disclaimerField}
            </>
          ) : (
            <>
              {photosField}
              <div className="my-6 flex flex-col items-center justify-between gap-2 md:flex-row">
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
                {priceField}
              </div>
              {tradeField}
              {disclaimerField}
            </>
          ))}

        {!isRail && (
          <div className="flex flex-wrap items-center gap-2">
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
        )}
        {isRail && (isSubmitting || isPausing) && (
          <p className="text-sm text-noir-gold-500" aria-live="polite">
            {isPausing ? tDestash("pausing") : tDestash("saving")}
          </p>
        )}
      </form>
    </div>
  )
}

export default DeStashForm
