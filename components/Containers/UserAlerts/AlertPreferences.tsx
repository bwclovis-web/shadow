import { useState } from "react"
import { useTranslations } from "next-intl"
import { BsBell, BsEnvelope, BsGear, BsX } from "react-icons/bs"

import { Button } from "~/components/Atoms/Button/Button"
import VooDooCheck from "~/components/Atoms/VooDooCheck"
import VooDooDetails from "~/components/Atoms/VooDooDetails/VooDooDetails"
import type { UserAlertPreferences } from "~/types/database"

interface AlertPreferencesProps {
  preferences: UserAlertPreferences
  onPreferencesChange: (
    preferences: Partial<UserAlertPreferences>
  ) => Promise<boolean>
}

interface StatusBadgeProps {
  enabled?: boolean
  value?: number
}

const StatusBadge = ({ enabled, value }: StatusBadgeProps) => {
  if (value !== undefined) {
    return (
      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
        {value}
      </span>
    )
  }
  return (
    <span
      className={`text-xs px-2 py-1 rounded ${
        enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  )
}

export const AlertPreferences = ({
  preferences,
  onPreferencesChange,
}: AlertPreferencesProps) => {
  const t = useTranslations("alerts")
  const tCommon = useTranslations("common")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Local edit state - only used during editing
  const [editState, setEditState] = useState({
    wishlistAlertsEnabled: preferences.wishlistAlertsEnabled,
    decantAlertsEnabled: preferences.decantAlertsEnabled,
    emailWishlistAlerts: preferences.emailWishlistAlerts,
    emailDecantAlerts: preferences.emailDecantAlerts,
    maxAlerts: preferences.maxAlerts,
  })

  const handleEdit = () => {
    // Initialize edit state from current preferences
    setEditState({
      wishlistAlertsEnabled: preferences.wishlistAlertsEnabled,
      decantAlertsEnabled: preferences.decantAlertsEnabled,
      emailWishlistAlerts: preferences.emailWishlistAlerts,
      emailDecantAlerts: preferences.emailDecantAlerts,
      maxAlerts: preferences.maxAlerts,
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const success = await onPreferencesChange(editState)
      if (success) {
        setIsEditing(false)
      }
    } catch (error) {
      console.error("Failed to save preferences:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const togglePreference = (key: keyof typeof editState) => {
    setEditState(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const updateMaxAlerts = (value: number) => {
    setEditState(prev => ({
      ...prev,
      maxAlerts: value,
    }))
  }

  return (
    <VooDooDetails
      summary={t("alertPreferences")}
      className="justify-around text-noir-gold"
      name="alert-preferences"
    >
      <div className="p-4 space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div className="text-sm text-noir-gold-100 mb-4">
              {t("alertPreferencesDescription")}
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-noir-gold flex items-center gap-2">
                <BsBell className="h-4 w-4" />
                {t("alertTypes")}
              </h4>

              <div className="space-y-2 ml-6">
                <VooDooCheck
                  id="wishlist-alerts"
                  checked={editState.wishlistAlertsEnabled}
                  onChange={() => togglePreference("wishlistAlertsEnabled")}
                  labelChecked={t("wishlistAlerts")}
                  labelUnchecked={t("wishlistAlerts")}
                />

                <VooDooCheck
                  id="decant-alerts"
                  checked={editState.decantAlertsEnabled}
                  onChange={() => togglePreference("decantAlertsEnabled")}
                  labelChecked={t("decantAlerts")}
                  labelUnchecked={t("decantAlerts")}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-noir-gold flex items-center gap-2">
                <BsEnvelope className="h-4 w-4" />
                {t("emailNotifications")}
              </h4>

              <div className="space-y-2 ml-6">
                <VooDooCheck
                  id="email-wishlist-alerts"
                  checked={editState.emailWishlistAlerts}
                  onChange={() => togglePreference("emailWishlistAlerts")}
                  labelChecked={t("emailWishlistAlerts")}
                  labelUnchecked={t("emailWishlistAlerts")}
                />

                <VooDooCheck
                  id="email-decant-alerts"
                  checked={editState.emailDecantAlerts}
                  onChange={() => togglePreference("emailDecantAlerts")}
                  labelChecked={t("emailDecantAlerts")}
                  labelUnchecked={t("emailDecantAlerts")}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-noir-gold-100">
                {t("alertLimits")}
              </h4>

              <div className="ml-6">
                <label className="block" htmlFor="max-alerts">
                  <div className="font-medium text-noir-gold-100 mb-1">
                    {t("maxAlerts")}
                  </div>
                  <div className="text-sm text-noir-gold-100 mb-2">
                    {t("maxAlertsDescription")}
                  </div>
                  <select
                    id="max-alerts"
                    value={editState.maxAlerts}
                    onChange={e => updateMaxAlerts(parseInt(e.target.value, 10))}
                    disabled={isSaving}
                    className="rounded border-noir-gold-100 text-noir-gold-100 focus:ring-noir-gold-100 focus:border-noir-gold-100 disabled:opacity-50"
                  >
                    <option value={5}>{t("maxAlertsOptions.5")}</option>
                    <option value={10}>{t("maxAlertsOptions.10")}</option>
                    <option value={20}>{t("maxAlertsOptions.20")}</option>
                    <option value={50}>{t("maxAlertsOptions.50")}</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? t("savingPreferences") : t("savePreferences")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
                leftIcon={<BsX className="h-4 w-4" />}
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-noir-gold-100">
                {t(
                  "alerts.alertPreferencesDescription",
                  "Configure how and when you receive alerts."
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEdit}
                leftIcon={<BsGear className="h-4 w-4" />}
              >
                {tCommon("edit")}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-noir-gold flex items-center gap-2">
                  <BsBell className="h-4 w-4" />
                  {t("alertTypes")}
                </h4>

                <div className="space-y-2 ml-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("wishlistAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.wishlistAlertsEnabled} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("decantAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.decantAlertsEnabled} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-noir-gold flex items-center gap-2">
                  <BsEnvelope className="h-4 w-4" />
                  {t("emailNotifications")}
                </h4>

                <div className="space-y-2 ml-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("emailWishlistAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.emailWishlistAlerts} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("emailDecantAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.emailDecantAlerts} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("maxAlerts")}
                    </span>
                    <StatusBadge value={preferences.maxAlerts} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </VooDooDetails>
  )
}

export default AlertPreferences
