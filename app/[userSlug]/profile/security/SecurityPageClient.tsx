"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import Input from "@/components/Atoms/Input/Input"
import ErrorDisplay from "@/components/Containers/ErrorDisplay/ErrorDisplay"
import { CSRFToken } from "@/components/Molecules/CSRFToken/CSRFToken"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"

import { ChangePasswordForm } from "@/components/Molecules/ChangePasswordForm/ChangePasswordForm"

import {
  confirmEnrollmentAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  startEnrollmentAction,
  type ConfirmEnrollmentState,
  type DisableTwoFactorState,
  type RegenerateBackupCodesState,
  type StartEnrollmentState,
} from "./actions"

type SecurityPageClientProps = {
  bannerImage: string
  twoFactorEnabled: boolean
  isAdmin: boolean
}

const BackupCodesList = ({ codes }: { codes: string[] }) => (
  <ul className="font-mono text-sm space-y-1 bg-noir-dark/40 p-4 rounded border border-noir-gold-500/30">
    {codes.map((code) => (
      <li key={code}>{code}</li>
    ))}
  </ul>
)

const SecurityPageClient = ({
  bannerImage,
  twoFactorEnabled,
  isAdmin,
}: SecurityPageClientProps) => {
  const t = useTranslations("twoFactor")
  const tPassword = useTranslations("password")
  const router = useRouter()
  const [useBackupForDisable, setUseBackupForDisable] = useState(false)

  const [startState, startFormAction] = useActionState(
    startEnrollmentAction,
    null as StartEnrollmentState
  )
  const [confirmState, confirmFormAction] = useActionState(
    confirmEnrollmentAction,
    null as ConfirmEnrollmentState
  )
  const [disableState, disableFormAction] = useActionState(
    disableTwoFactorAction,
    null as DisableTwoFactorState
  )
  const [regenState, regenFormAction] = useActionState(
    regenerateBackupCodesAction,
    null as RegenerateBackupCodesState
  )

  const showQr = startState?.success === true
  const backupCodes =
    confirmState?.success === true
      ? confirmState.backupCodes
      : regenState?.success === true
        ? regenState.backupCodes
        : null

  useEffect(() => {
    if (confirmState?.success || disableState?.success) {
      router.refresh()
    }
  }, [confirmState?.success, disableState?.success, router])

  return (
    <section>
      <TitleBanner
        image={bannerImage}
        heading={t("title")}
        subheading={t("subheading")}
      />
      <div className="inner-container max-w-lg mx-auto py-8 space-y-8">
        <div className="bg-white shadow-lg rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">{tPassword("changePassword")}</h2>
          <p className="text-sm text-gray-700">{tPassword("updatePasswordToKeepAccountSecure")}</p>
          <ChangePasswordForm hideHeading />
        </div>

        <h2 className="text-lg font-semibold text-noir-gold-100 pt-2">
          {t("twoFactorSectionTitle")}
        </h2>

        {isAdmin && !twoFactorEnabled && (
          <p className="text-sm text-noir-gold-100/90 border border-noir-gold-500/40 rounded p-3">
            {t("adminRecommendation")}
          </p>
        )}

        {!twoFactorEnabled && !backupCodes && (
          <div className="bg-white shadow-lg rounded-lg p-6 space-y-4">
            <p className="text-sm text-gray-700">{t("disabledDescription")}</p>
            {startState?.success === false && (
              <ErrorDisplay
                error={startState.error}
                variant="inline"
                title={t("errorTitle")}
              />
            )}
            {!showQr ? (
              <form action={startFormAction}>
                <CSRFToken />
                <Button type="submit" variant="icon" background="gold" size="lg">
                  {t("enableButton")}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">{t("scanQr")}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={startState.qrDataUrl}
                  alt={t("qrAlt")}
                  className="mx-auto w-48 h-48"
                />
                <p className="text-xs text-gray-600 break-all">
                  {t("manualKey")}: {startState.manualKey}
                </p>
                <form action={confirmFormAction} className="space-y-3">
                  <CSRFToken />
                  <Input
                    shading
                    inputId="password"
                    label={t("currentPassword")}
                    inputType="password"
                    name="password"
                  />
                  <Input
                    shading
                    inputId="code"
                    label={t("verificationCode")}
                    inputType="text"
                    name="code"
                    autoComplete="one-time-code"
                  />
                  {confirmState?.success === false && (
                    <ErrorDisplay
                      error={confirmState.error}
                      variant="inline"
                      title={t("errorTitle")}
                    />
                  )}
                  <Button type="submit" variant="icon" background="gold" size="lg">
                    {t("confirmEnable")}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {backupCodes && (
          <div className="bg-white shadow-lg rounded-lg p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">{t("backupCodesTitle")}</h2>
            <p className="text-sm text-amber-800">{t("backupCodesWarning")}</p>
            <BackupCodesList codes={backupCodes} />
          </div>
        )}

        {twoFactorEnabled && !backupCodes && (
          <>
            <div className="bg-white shadow-lg rounded-lg p-6">
              <p className="text-sm text-green-800 font-medium">{t("enabledStatus")}</p>
            </div>

            <div className="bg-white shadow-lg rounded-lg p-6 space-y-3">
              <h2 className="font-semibold text-gray-900">{t("regenerateTitle")}</h2>
              <form action={regenFormAction} className="space-y-3">
                <CSRFToken />
                <Input
                  shading
                  inputId="regen-password"
                  label={t("currentPassword")}
                  inputType="password"
                  name="password"
                />
                <Input
                  shading
                  inputId="regen-code"
                  label={t("verificationCode")}
                  inputType="text"
                  name="code"
                />
                {regenState?.success === false && (
                  <ErrorDisplay
                    error={regenState.error}
                    variant="inline"
                    title={t("errorTitle")}
                  />
                )}
                <Button type="submit" variant="icon" background="gold" size="md">
                  {t("regenerateButton")}
                </Button>
              </form>
            </div>

            <div className="bg-white shadow-lg rounded-lg p-6 space-y-3">
              <h2 className="font-semibold text-gray-900">{t("disableTitle")}</h2>
              <form action={disableFormAction} className="space-y-3">
                <CSRFToken />
                <input
                  type="hidden"
                  name="useBackupCode"
                  value={String(useBackupForDisable)}
                />
                <Input
                  shading
                  inputId="disable-password"
                  label={t("currentPassword")}
                  inputType="password"
                  name="password"
                />
                <Input
                  shading
                  inputId="disable-code"
                  label={
                    useBackupForDisable
                      ? t("backupCodeLabel")
                      : t("verificationCode")
                  }
                  inputType="text"
                  name="code"
                />
                <button
                  type="button"
                  className="text-sm text-noir-gold underline"
                  onClick={() => setUseBackupForDisable((v) => !v)}
                >
                  {useBackupForDisable ? t("useAuthenticator") : t("useBackupCode")}
                </button>
                {disableState?.success === false && (
                  <ErrorDisplay
                    error={disableState.error}
                    variant="inline"
                    title={t("errorTitle")}
                  />
                )}
                {disableState?.success === true && (
                  <p className="text-sm text-green-800">{disableState.message}</p>
                )}
                <Button type="submit" variant="icon" background="gold" size="md">
                  {t("disableButton")}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default SecurityPageClient
