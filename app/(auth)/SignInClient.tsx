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
import { UserLogInSchema } from "@/utils/validation/formValidationSchemas"
import { signInAction, type SignInActionState } from "@/app/(auth)/sign-in/actions"
import PageWrapper from "@/components/Containers/Pagewrapper/PageWrapper"

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
    <main id="main-content">
      <PageWrapper>
      <form
        {...getFormProps(signInForm)}
        action={formAction}
        className="max-w-md mx-auto p-1 md:p-4 relative w-full flex flex-col gap-4 noir-border"
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
        <Button type="submit" variant="icon" background="gold" size="xl">
          {t("submit")}
        </Button>
      </form>
    </PageWrapper>
    </main>
  )
}

export default SignInClient
