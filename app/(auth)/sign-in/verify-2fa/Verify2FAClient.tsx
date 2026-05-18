"use client"

import { useActionState, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import Input from "@/components/Atoms/Input/Input"
import ErrorDisplay from "@/components/Containers/ErrorDisplay/ErrorDisplay"
import { CSRFToken } from "@/components/Molecules/CSRFToken/CSRFToken"
import { verify2faAction, type Verify2faActionState } from "./actions"

const Verify2FAClient = () => {
  const t = useTranslations("auth.verify2fa")
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [state, formAction] = useActionState(verify2faAction, null as Verify2faActionState)

  return (
    <section className="flex flex-col p-1 md:px-4 w-full mx-auto">
      <div className="max-w-md mx-auto p-1 md:p-4 w-full">
        <h1 className="text-2xl font-semibold text-noir-gold mb-2">{t("heading")}</h1>
        <p className="text-noir-gold-100/80 mb-6 text-sm">{t("subheading")}</p>
        <form
          action={formAction}
          className="flex flex-col gap-4 noir-border p-4"
        >
          <CSRFToken />
          <input type="hidden" name="useBackupCode" value={String(useBackupCode)} />
          <Input
            shading
            inputId="code"
            label={useBackupCode ? t("backupCodeLabel") : t("codeLabel")}
            inputType="text"
            name="code"
            autoComplete="one-time-code"
          />
          {state?.error && (
            <ErrorDisplay error={state.error} variant="inline" title={t("errorTitle")} />
          )}
          <Button type="submit" variant="icon" background="gold" size="xl">
            {t("submit")}
          </Button>
          <button
            type="button"
            className="text-sm text-noir-gold underline"
            onClick={() => setUseBackupCode((v) => !v)}
          >
            {useBackupCode ? t("useAuthenticator") : t("useBackupCode")}
          </button>
        </form>
      </div>
    </section>
  )
}

export default Verify2FAClient
