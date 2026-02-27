"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useRef } from "react"
import { useTranslations } from "next-intl"

import Input from "@/components/Atoms/Input/Input"
import { Button } from "@/components/Atoms/Button/Button"
import ErrorDisplay from "@/components/Containers/ErrorDisplay/ErrorDisplay"
import { CSRFToken } from "@/components/Molecules/CSRFToken/CSRFToken"
import { UserLogInSchema } from "@/utils/validation/formValidationSchemas"

interface SignInClientProps {
  /** Error message from server (e.g. invalid credentials). Pass from page via Server Action or API response. */
  error?: string | null
  /** Action URL for form POST. Wire to /api/auth/sign-in or a Server Action. */
  action?: string
}

const SignInClient = ({
  error,
  action = "/api/auth/sign-in",
}: SignInClientProps) => {
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const t = useTranslations("forms")

  const [signInForm, { email, password }] = useForm({
    constraint: getZodConstraint(UserLogInSchema),
    onValidate: ({ formData }) => parseWithZod(formData, { schema: UserLogInSchema }),
  })

  return (
    <section className="flex flex-col p-1 md:px-4 w-full mx-auto">
      <form
        {...getFormProps(signInForm)}
        method="POST"
        action={action}
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
        {error && (
          <ErrorDisplay error={error} variant="inline" title="Sign-in Error" />
        )}
        <Button type="submit" variant="icon" background="gold" size="xl">
          {t("submit")}
        </Button>
      </form>
    </section>
  )
}

export default SignInClient
