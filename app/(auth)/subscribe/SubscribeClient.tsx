"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useActionState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import Input from "@/components/Atoms/Input"
import { Button } from "@/components/Atoms/Button/Button"
import ErrorDisplay from "@/components/Containers/ErrorDisplay/ErrorDisplay"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import { SubscribeCheckoutSchema } from "@/utils/validation/formValidationSchemas"
import { subscribeAction, type SubscribeActionState } from "./actions"

const SubscribeClient = () => {
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get("redirect") || "/sign-up"
  const canceled = searchParams.get("canceled") === "1"
  const inputRef = useRef<HTMLInputElement | null>(null)
  const t = useTranslations("subscribe")
  const tForms = useTranslations("forms")

  const [state, formAction] = useActionState(
    subscribeAction,
    null as SubscribeActionState
  )

  const [form, { email }] = useForm({
    lastResult: state?.submission,
    constraint: getZodConstraint(SubscribeCheckoutSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: SubscribeCheckoutSchema }),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })

  return (
    <main id="main-content" className="w-full">
      <form
        {...getFormProps(form)}
        action={formAction}
        className="relative mx-auto flex w-full max-w-md flex-col gap-4 noir-border bg-noir-dark/30 p-4 backdrop-blur-sm md:p-6 lg:mx-0 lg:max-w-none"
      >
        <CSRFToken />
        <input type="hidden" name="redirect" value={redirectPath} />
        <p className="text-sm text-noir-gold-100">{t("paymentRequired")}</p>
        {canceled && !state?.error && (
          <ErrorDisplay
            error={t("canceledNotice")}
            variant="inline"
            title={t("heading")}
          />
        )}
        <Input
          shading={true}
          inputId="email"
          label={tForms("emailLabel")}
          inputType="email"
          action={email}
          inputRef={inputRef}
          helpText={t("emailHelp")}
        />
        {state?.error && (
          <ErrorDisplay
            error={state.error}
            variant="inline"
            title={t("heading")}
          />
        )}
        <Button type="submit" variant="icon" background="gold" size="xl">
          {t("cta")}
        </Button>
      </form>
    </main>
  )
}

export default SubscribeClient
