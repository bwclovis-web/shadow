import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import type { ChangeEvent } from "react"
import { useRef, useState } from "react"
import { Form, useActionData, useLoaderData } from "react-router"

import Input from "~/components/Atoms/Input"
import { CSRFToken } from "~/components/Molecules/CSRFToken"
import PasswordStrengthIndicator from "~/components/Organisms/PasswordStrengthIndicator"
import { login } from "~/models/session.server"
import {
  createUser,
  FreeSignupLimitReachedError,
  getUserByName,
} from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { UserFormSchema } from "@/utils/validation/formValidationSchemas"
import { getSignupSubscribeRateLimits } from "@/utils/rate-limit-config.server"
import { getClientIdentifier } from "@/utils/server/request.server"
import { getCheckoutSession } from "@/utils/server/stripe.server"
import { canSignupForFree } from "@/utils/server/user-limit.server"

export const ROUTE_PATH = "/sign-up"

import { useTranslations } from "next-intl"
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router"

import { Button } from "@/components/Atoms/Button/Button"    
import CheckBox from "@/components/Atoms/CheckBox/CheckBox"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  return {
    sessionId: url.searchParams.get("session_id"),
    email: url.searchParams.get("email"),
  }
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const formData = await request.formData()
  const { requireCSRF } = await import("~/utils/server/csrf.server")
  await requireCSRF(request, formData)

  const rateLimits = getSignupSubscribeRateLimits()
  const clientId = getClientIdentifier(request)
  try {
    validateRateLimit(
      `signup:${clientId}`,
      rateLimits.signup.max,
      rateLimits.signup.windowMs
    )
  } catch (res) {
    if (res instanceof Response) {
      return {
        error:
          "Too many signup attempts. Please try again in a few minutes.",
        submission: undefined,
      }
    }
    throw res
  }

  // Gate signup first: redirect to subscribe when free signup limit is reached
  // (Skip this only when coming from Stripe with a valid paid session.)
  const sessionId = (formData.get("session_id") as string)?.trim() || null
  if (!sessionId) {
    const allowed = await canSignupForFree()
    if (!allowed) {
      throw redirect("/subscribe?redirect=/sign-up")
    }
  }

  // Validate the form data
  const submission = parseWithZod(formData, { schema: UserFormSchema })

  if (submission.status !== "success") {
    return {
      error: "Please check the form for errors",
      submission: submission.reply(),
    }
  }

  // Check if user already exists
  const existingUser = await getUserByName(formData.get("email") as string)
  if (existingUser) {
    return { error: "Email already taken" }
  }

  if (sessionId) {
    const session = await getCheckoutSession(sessionId)
    const formEmail = (formData.get("email") as string)?.toLowerCase()
    const sessionEmail = (
      (session?.customer_details?.email as string) ||
      (session?.customer_email as string)
    )?.toLowerCase()
    if (
      session?.status === "complete" &&
      sessionEmail &&
      formEmail &&
      sessionEmail === formEmail
    ) {
      const user = await createUser(formData, {
        subscriptionStatus: "paid",
        isEarlyAdopter: false,
      })
      return await login({ context: {} as any, userId: user.id })
    }
  }

  // No valid paid session: require under limit for free signup
  const allowed = await canSignupForFree()
  if (!allowed) {
    throw redirect("/subscribe?redirect=/sign-up")
  }

  try {
    const user = await createUser(formData)
    return await login({ context: {} as any, userId: user.id })
  } catch (err) {
    if (err instanceof FreeSignupLimitReachedError) {
      throw redirect("/subscribe?redirect=/sign-up")
    }
    throw err
  }
}

const RegisterPage = () => {
  const actionData = useActionData<typeof action>()
  const { sessionId, email: prefillEmail } = useLoaderData<typeof loader>()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { t } = useTranslation()
  const [passwordValue, setPasswordValue] = useState("")
  const [signupForm, { email, password, confirmPassword, acceptTerms }] = useForm({
    lastResult: actionData?.submission,
    constraint: getZodConstraint(UserFormSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: UserFormSchema })
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })

  return (
    <section className="flex flex-col items-center px-4 w-full max-w-md mx-auto ">
      <Form
        {...getFormProps(signupForm)}
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
          label={t("forms.emailLabel")}
          inputType="email"
          action={email}
          inputRef={inputRef}
          defaultValue={prefillEmail ?? ""}
        />
        <div>
          <Input
            shading={true}
            inputId="password"
            label={t("forms.passwordLabel")}
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
          label={t("forms.passwordMatchLabel")}
          inputType="password"
          action={confirmPassword}
          inputRef={inputRef}
        />

        {/* Password Requirements */}
        <div className="bg-noir-dark border border-noir-gold rounded-md p-3 text-xs text-noir-gold">
          <p className="font-medium mb-1">{t("auth.passwordRequirements")}</p>
          <ul className="space-y-1">
            <li>• {t("auth.passwordRequirementsList.8characters")}</li>
            <li>• {t("auth.passwordRequirementsList.uppercase")}</li>
            <li>• {t("auth.passwordRequirementsList.number")}</li>
            <li>• {t("auth.passwordRequirementsList.special")}</li>
            <li>• {t("auth.passwordRequirementsList.spaces")}</li>
            <li>• {t("auth.passwordRequirementsList.different")}</li>
          </ul>
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className="flex items-start gap-2">
          <CheckBox
            type="wild"
            id="acceptTerms"
            name="acceptTerms"
            value="on"
            required
            className="mt-1"
            htmlLabel={`${t("auth.termsAndConditions")} <a href='/terms-and-conditions' class='text-noir-gold hover:text-noir-light'>${t("auth.termsAndConditionsLink")}</a>`}
            labelSize="sm"
            labelPosition="right"
          />
        </div>
        {acceptTerms?.errors && (
          <p className="text-red-600 text-sm">{acceptTerms.errors.join(" ")}</p>
        )}

        {/* Display form-level errors */}
        {signupForm.errors && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
            <p className="font-medium mb-1">Please fix the following errors:</p>
            <ul className="list-disc list-inside">
              {signupForm.errors.map(error => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {actionData?.error && (
          <p className="text-red-600 mb-2">{actionData.error}</p>
        )}
        <Button type="submit" variant={"icon"} background={"gold"} size={"xl"}>
          {t("forms.submit")}
        </Button>
      </Form>
    </section>
  )
}

export default RegisterPage
