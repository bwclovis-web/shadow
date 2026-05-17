"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { BsPhone } from "react-icons/bs"

import { Button } from "@/components/Atoms/Button/Button"
import VooDooCheck from "@/components/Atoms/VooDooCheck"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import type { UserAlertPreferences } from "@/types/database"

type PushEditState = Pick<
  UserAlertPreferences,
  "pushEnabled" | "pushTradeAlerts" | "pushMessageAlerts"
>

type PushNotificationSectionProps = {
  preferences: UserAlertPreferences
  isEditing: boolean
  isSaving: boolean
  editState: PushEditState
  onEditStateChange: (patch: Partial<PushEditState>) => void
  onPreferencesChange: (
    preferences: Partial<UserAlertPreferences>
  ) => Promise<boolean>
}

const StatusBadge = ({ enabled }: { enabled: boolean }) => (
  <span
    className={`text-xs px-2 py-1 rounded ${
      enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
    }`}
  >
    {enabled ? "Enabled" : "Disabled"}
  </span>
)

export const PushNotificationSection = ({
  preferences,
  isEditing,
  isSaving,
  editState,
  onEditStateChange,
  onPreferencesChange,
}: PushNotificationSectionProps) => {
  const t = useTranslations("alerts")
  const { isSupported, isConfigured, isLoading, isSubscribing, subscribe, unsubscribe } =
    usePushNotifications()
  const [pushError, setPushError] = useState<string | null>(null)

  const handleEnablePush = async () => {
    setPushError(null)
    const result = await subscribe()
    if (!result.ok) {
      const messageKey =
        result.reason === "denied"
          ? "pushDenied"
          : result.reason === "unsupported"
            ? "pushUnsupported"
            : result.reason === "no-vapid"
              ? "pushNotConfigured"
              : "pushSubscribeFailed"
      setPushError(t(messageKey))
      return
    }
    const success = await onPreferencesChange({
      pushEnabled: true,
      pushTradeAlerts: true,
      pushMessageAlerts: true,
    })
    if (success) {
      onEditStateChange({
        pushEnabled: true,
        pushTradeAlerts: true,
        pushMessageAlerts: true,
      })
    }
  }

  const handleDisablePush = async () => {
    setPushError(null)
    await unsubscribe()
    const success = await onPreferencesChange({ pushEnabled: false })
    if (success) {
      onEditStateChange({ pushEnabled: false })
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-noir-gold flex items-center gap-2">
        <BsPhone className="h-4 w-4" />
        {t("pushNotifications")}
      </h4>

      {!isEditing ? (
        <PushViewMode preferences={preferences} t={t} />
      ) : (
        <div className="space-y-3 ml-6">
          {!isSupported ? (
            <p className="text-xs text-noir-gold-100/80">{t("pushUnsupported")}</p>
          ) : !isConfigured && !isLoading ? (
            <p className="text-xs text-noir-gold-100/80">{t("pushNotConfigured")}</p>
          ) : (
            <>
              <p className="text-xs text-noir-gold-100/80">{t("pushDescription")}</p>
              {editState.pushEnabled ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDisablePush}
                  disabled={isSaving || isSubscribing}
                >
                  {isSubscribing ? t("pushWorking") : t("disablePush")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleEnablePush}
                  disabled={isSaving || isSubscribing || isLoading}
                >
                  {isSubscribing ? t("pushWorking") : t("enablePush")}
                </Button>
              )}
              {pushError ? (
                <p className="text-xs text-red-400" role="alert">
                  {pushError}
                </p>
              ) : null}
              <PushToggles
                editState={editState}
                isSaving={isSaving}
                onEditStateChange={onEditStateChange}
                t={t}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

const PushViewMode = ({
  preferences,
  t,
}: {
  preferences: UserAlertPreferences
  t: ReturnType<typeof useTranslations<"alerts">>
}) => (
  <div className="space-y-2 ml-6">
    <div className="flex items-center justify-between">
      <span className="text-sm text-noir-gold-100">{t("pushEnabled")}</span>
      <StatusBadge enabled={preferences.pushEnabled} />
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm text-noir-gold-100">{t("pushTradeAlerts")}</span>
      <StatusBadge enabled={preferences.pushTradeAlerts && preferences.pushEnabled} />
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm text-noir-gold-100">{t("pushMessageAlerts")}</span>
      <StatusBadge enabled={preferences.pushMessageAlerts && preferences.pushEnabled} />
    </div>
  </div>
)

const PushToggles = ({
  editState,
  isSaving,
  onEditStateChange,
  t,
}: {
  editState: PushEditState
  isSaving: boolean
  onEditStateChange: (patch: Partial<PushEditState>) => void
  t: ReturnType<typeof useTranslations<"alerts">>
}) => (
  <div className="space-y-2 pt-2">
    <VooDooCheck
      id="push-trade-alerts"
      checked={editState.pushTradeAlerts}
      disabled={!editState.pushEnabled || isSaving}
      onChange={() =>
        onEditStateChange({ pushTradeAlerts: !editState.pushTradeAlerts })
      }
      labelChecked={t("pushTradeAlerts")}
      labelUnchecked={t("pushTradeAlerts")}
    />
    <VooDooCheck
      id="push-message-alerts"
      checked={editState.pushMessageAlerts}
      disabled={!editState.pushEnabled || isSaving}
      onChange={() =>
        onEditStateChange({ pushMessageAlerts: !editState.pushMessageAlerts })
      }
      labelChecked={t("pushMessageAlerts")}
      labelUnchecked={t("pushMessageAlerts")}
    />
  </div>
)
