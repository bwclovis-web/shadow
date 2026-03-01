"use client"

import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import type { ChangeEvent } from "react"
import { useRef, useState, useActionState } from "react"
import { useTranslations } from "next-intl"

import Input from "@/components/Atoms/Input"
import { Button } from "@/components/Atoms/Button/Button"
import CheckBox from "@/components/Atoms/CheckBox/CheckBox"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import PasswordStrengthIndicator from "@/components/Organisms/PasswordStrengthIndicator"
import { UserFormSchema } from "@/utils/validation/formValidationSchemas"
import { signUpAction, type SignUpActionState } from "./actions"

interface SignUpClientProps {
  sessionId?: string | null
  prefillEmail?: string | null
}

const SignUpClient = ({ sessionId, prefillEmail }: SignUpClientProps) => {
  const [state, formAction] = useActionState(signUpAction, null as SignUpActionState)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [passwordValue, setPasswordValue] = useState("")
  const tForms = useTranslations("forms")
  const tAuth = useTranslations("auth")

  const [signupForm, { email, password, confirmPassword, acceptTerms }] = useForm({
    lastResult: state?.submission,
    constraint: getZodConstraint(UserFormSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: UserFormSchema }),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })

  return (
    <section className="flex flex-col items-center px-4 w-full max-w-md mx-auto">
      <form
        {...getFormProps(signupForm)}
        action={formAction}
        method="POST"
        className="max-w-md mx-auto p-4 relative w-full flex flex-col gap-4 noir-border"
      >
        <CSRFToken />
        {sessionId ? (
          <input type="hidden" name="session_id" value={sessionId} />
        ) : null}
        <Input
          shading={true}
          inputId="email"
          label={tForms("emailLabel")}
          inputType="email"
          action={email}
          inputRef={inputRef}
          defaultValue={prefillEmail ?? ""}
        />
        <div>
          <Input
            shading={true}
            inputId="password"
            label={tForms("passwordLabel")}
            inputType="password"
            action={password}
            inputRef={inputRef}
            onChange={(evt: ChangeEvent<HTMLInputElement>) => {
              setPasswordValue(evt.target.value)
            }}
          />
          {passwordValue && (
            <div className="mt-2">
              <PasswordStrengthIndicator password={passwordValue} />
            </div>
          )}
        </div>
        <Input
          shading={true}
          inputId="passwordMatch"
          label={tForms("passwordMatchLabel")}
          inputType="password"
          action={confirmPassword}
          inputRef={inputRef}
        />

        <div className="bg-noir-dark border border-noir-gold rounded-md p-3 text-xs text-noir-gold">
          <p className="font-medium mb-1">{tAuth("passwordRequirements")}</p>
          <ul className="space-y-1">
            <li>• {tAuth("passwordRequirementsList.8characters")}</li>
            <li>• {tAuth("passwordRequirementsList.uppercase")}</li>
            <li>• {tAuth("passwordRequirementsList.number")}</li>
            <li>• {tAuth("passwordRequirementsList.special")}</li>
            <li>• {tAuth("passwordRequirementsList.spaces")}</li>
            <li>• {tAuth("passwordRequirementsList.different")}</li>
          </ul>
        </div>

        <div className="flex items-start gap-2">
          <CheckBox
            type="wild"
            id="acceptTerms"
            name="acceptTerms"
            value="on"
            required
            className="mt-1"
            htmlLabel={`${tAuth("termsAndConditions")} <a href='/terms-and-conditions' class='text-noir-gold hover:text-noir-light'>${tAuth("termsAndConditionsLink")}</a>`}
            labelSize="sm"
            labelPosition="right"
          />
        </div>
        {Array.isArray(acceptTerms?.errors) && acceptTerms.errors.length > 0 && (
          <p className="text-red-600 text-sm">{acceptTerms.errors.join(" ")}</p>
        )}

        {Array.isArray(signupForm.errors) && signupForm.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
            <p className="font-medium mb-1">Please fix the following errors:</p>
            <ul className="list-disc list-inside">
              {signupForm.errors.map(error => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {state?.error && (
          <p className="text-red-600 mb-2">{state.error}</p>
        )}
        <Button type="submit" variant="icon" background="gold" size="xl">
          {tForms("submit")}
        </Button>
      </form>
    </section>
  )
}

export default SignUpClient
