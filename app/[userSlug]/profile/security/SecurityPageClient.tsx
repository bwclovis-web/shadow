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
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

import {
  confirmEnrollmentAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  revokeAllOtherSessionsAction,
  revokeSessionAction,
  startEnrollmentAction,
  type ActiveSessionRow,
  type ConfirmEnrollmentState,
  type DisableTwoFactorState,
  type RegenerateBackupCodesState,
  type RevokeSessionState,
  type StartEnrollmentState,
} from "./actions"

type SecurityPageClientProps = {
  bannerImage: string
  twoFactorEnabled: boolean
  isAdmin: boolean
  require2fa: boolean
  sessions: ActiveSessionRow[]
}

const BackupCodesList = ({ codes }: { codes: string[] }) => (
  <ul className="font-mono text-sm space-y-1 bg-noir-dark/40 p-4 rounded border border-noir-gold-500/30">
    {codes.map((code) => (
      <li key={code}>{code}</li>
    ))}
  </ul>
)

const summarizeUserAgent = (ua: string | null): string => {
  if (!ua?.trim()) return "Unknown device"
  const trimmed = ua.trim()
  if (trimmed.length <= 80) return trimmed
  return `${trimmed.slice(0, 77)}…`
}

const SecurityPageClient = ({
  bannerImage,
  twoFactorEnabled,
  isAdmin,
  require2fa,
  sessions,
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
  const [revokeState, revokeFormAction] = useActionState(
    revokeSessionAction,
    null as RevokeSessionState
  )
  const [revokeAllState, revokeAllFormAction] = useActionState(
    revokeAllOtherSessionsAction,
    null as RevokeSessionState
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

  useEffect(() => {
    if (revokeState?.success || revokeAllState?.success) {
      router.refresh()
    }
  }, [revokeState?.success, revokeAllState?.success, router])

  const adminGate = (isAdmin || require2fa) && !twoFactorEnabled

  return (
    <main id="main-content">
      <TitleBanner
        image={bannerImage}
        heading={t("title")}
        subheading={t("subheading")}
      />
      <PageWrapper>
        <div className=" mb-4">
          <h2>{tPassword("changePassword")}</h2>
          <p className="text-sm text-noir-gold-100 mb-4">
            {tPassword("updatePasswordToKeepAccountSecure")}
          </p>
          <ChangePasswordForm hideHeading />
        </div>

        <div className="py-6 space-y-4 border-t border-noir-gold-500/20">
          <h2>{t("sessionsTitle")}</h2>
          <p className="text-sm text-noir-gold-100">{t("sessionsDescription")}</p>
          {(revokeState?.success === false || revokeAllState?.success === false) && (
            <ErrorDisplay
              error={
                (revokeState?.success === false && revokeState.error) ||
                (revokeAllState?.success === false && revokeAllState.error) ||
                t("errorTitle")
              }
              variant="inline"
              title={t("errorTitle")}
            />
          )}
          <ul className="space-y-3">
            {sessions.length === 0 ? (
              <li className="text-sm text-noir-gold-100">{t("sessionsEmpty")}</li>
            ) : (
              sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-2 rounded border border-noir-gold-500/30 bg-noir-dark/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm text-noir-gold-100">
                    <p className="truncate font-medium text-noir-gold">
                      {summarizeUserAgent(session.userAgent)}
                    </p>
                    <p className="text-xs opacity-80">
                      {session.ipAddress ?? "—"} ·{" "}
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <form action={revokeFormAction}>
                    <CSRFToken />
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Button type="submit" variant="icon" background="gold" size="sm">
                      {t("revokeSession")}
                    </Button>
                  </form>
                </li>
              ))
            )}
          </ul>
          <form action={revokeAllFormAction}>
            <CSRFToken />
            <Button type="submit" variant="icon" background="gold" size="md">
              {t("signOutEverywhere")}
            </Button>
          </form>
        </div>

        <h2 className="pt-2">
          {t("twoFactorSectionTitle")}
        </h2>

        {adminGate && (
          <p className="text-sm text-amber-200/95 rounded border border-amber-500/40 bg-amber-950/40 p-3">
            {t("adminRequired")}
          </p>
        )}

        {!twoFactorEnabled && !backupCodes && (
          <div className="py-6 space-y-4">
            <p className="text-sm text-noir-gold-500">{t("disabledDescription")}</p>
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
                <p className="text-sm text-noir-gold-100">{t("scanQr")}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={startState.qrDataUrl}
                  alt={t("qrAlt")}
                  className="mx-auto w-48 h-48"
                />
                <p className="text-xs text-noir-gold-100 break-all">
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
                  />
                  {confirmState?.success === false && (
                    <ErrorDisplay
                      error={confirmState.error}
                      variant="inline"
                      title={t("errorTitle")}
                    />
                  )}
                  <Button type="submit" variant="icon" background="gold" size="md">
                    {t("confirmEnable")}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {backupCodes && (
          <div className="py-6 space-y-3">
            <h3 className="font-semibold text-noir-gold">{t("backupCodesTitle")}</h3>
            <p className="text-sm text-noir-gold-100">{t("backupCodesWarning")}</p>
            <BackupCodesList codes={backupCodes} />
          </div>
        )}

        {twoFactorEnabled && !backupCodes && (
          <>
            <p className="text-sm text-noir-gold-500 py-2">{t("enabledStatus")}</p>
            <div className="bg-white shadow-lg rounded-lg p-6 space-y-3 mb-4">
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
      </PageWrapper>
    </main>
  )
}

export default SecurityPageClient
