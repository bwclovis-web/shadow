"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useActionState, useRef } from "react"
import { useTranslations } from "next-intl"

import Input from "@/components/Atoms/Input/Input"
import { Button } from "@/components/Atoms/Button/Button"
import ErrorDisplay from "@/components/Containers/ErrorDisplay/ErrorDisplay"
import { CSRFToken } from "@/components/Molecules/CSRFToken/CSRFToken"
import { UserLogInSchema } from "@/utils/validation/formValidationSchemas"
import { signInAction, type SignInActionState } from "@/app/(auth)/sign-in/actions"

const SignInClient = () => {
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const t = useTranslations("forms")

  const [state, formAction] = useActionState(signInAction, null as SignInActionState)

  const [signInForm, { email, password }] = useForm({
    constraint: getZodConstraint(UserLogInSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: UserLogInSchema }),
  })

  return (
    <section className="flex flex-col p-1 md:px-4 w-full mx-auto">
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
    </section>
  )
}

export default SignInClient
