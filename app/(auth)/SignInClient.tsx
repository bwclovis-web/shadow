"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useActionState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import Input from "@/components/Atoms/Input/Input"
import { Button } from "@/components/Atoms/Button/Button"
import ErrorDisplay from "@/components/Containers/ErrorDisplay/ErrorDisplay"
import { CSRFToken } from "@/components/Molecules/CSRFToken/CSRFToken"
import { TurnstileField } from "@/components/Molecules/Turnstile/TurnstileField"
import { UserLogInSchema } from "@/utils/validation/formValidationSchemas"
import { signInAction, type SignInActionState } from "@/app/(auth)/sign-in/actions"

const SignInClient = () => {
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const searchParams = useSearchParams()
  const t = useTranslations("forms")
  const tAuth = useTranslations("auth.signIn")
  const isSuspended = searchParams.get("suspended") === "1"

  const [state, formAction] = useActionState(signInAction, null as SignInActionState)

  const [signInForm, { email, password }] = useForm({
    constraint: getZodConstraint(UserLogInSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: UserLogInSchema }),
  })

  return (
    <main id="main-content" className="w-full">
      <form
        {...getFormProps(signInForm)}
        action={formAction}
        className="relative mx-auto flex w-full max-w-md flex-col gap-4 noir-border bg-noir-dark/30 p-4 backdrop-blur-sm md:p-6 lg:mx-0 lg:max-w-none"
      >
        <CSRFToken />
        <Input
          shading={true}
          inputId="email"
          label={t("emailLabel")}
          inputType="email"
          action={email}
          inputRef={emailInputRef}
        />
        <Input
          shading={true}
          inputId="password"
          label={t("passwordLabel")}
          inputType="password"
          action={password}
        />
        <TurnstileField />
        {isSuspended && !state?.error && (
          <ErrorDisplay
            error={tAuth("suspended")}
            variant="inline"
            title="Sign-in Error"
          />
        )}
        {state?.error && (
          <ErrorDisplay
            error={state.error}
            variant="inline"
            title="Sign-in Error"
          />
        )}
        <Button
          type="submit"
          variant="icon"
          background="gold"
          size="xl"
          data-testid="sign-in-submit"
        >
          {t("submit")}
        </Button>
      </form>
    </main>
  )
}

export default SignInClient
