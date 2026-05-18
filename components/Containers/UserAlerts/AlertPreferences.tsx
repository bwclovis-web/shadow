"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { BsBell, BsEnvelope, BsGear, BsX } from "react-icons/bs"

import { Button } from "@/components/Atoms/Button/Button"
import VooDooCheck from "@/components/Atoms/VooDooCheck"
import VooDooDetails from "@/components/Atoms/VooDooDetails/VooDooDetails"
import type { UserAlertPreferences } from "@/types/database"

import { PushNotificationSection } from "./PushNotificationSection"

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

const StatusBadge = ({ enabled, value }: StatusBadgeProps) =>
  value !== undefined ? (
    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
      {value}
    </span>
  ) : (
    <span
      className={`text-xs px-2 py-1 rounded ${
        enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  )

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
    emailTradeAlerts: preferences.emailTradeAlerts ?? false,
    securityAlertsEnabled: preferences.securityAlertsEnabled ?? true,
    emailSecurityAlerts: preferences.emailSecurityAlerts ?? true,
    pushEnabled: preferences.pushEnabled ?? false,
    pushTradeAlerts: preferences.pushTradeAlerts ?? true,
    pushMessageAlerts: preferences.pushMessageAlerts ?? true,
    followAlertsEnabled: preferences.followAlertsEnabled ?? true,
    emailFollowAlerts: preferences.emailFollowAlerts ?? false,
    pushFollowAlerts: preferences.pushFollowAlerts ?? true,
    maxAlerts: preferences.maxAlerts,
  })

  const handleEdit = () => {
    // Initialize edit state from current preferences
    setEditState({
      wishlistAlertsEnabled: preferences.wishlistAlertsEnabled,
      decantAlertsEnabled: preferences.decantAlertsEnabled,
      emailWishlistAlerts: preferences.emailWishlistAlerts,
      emailDecantAlerts: preferences.emailDecantAlerts,
      emailTradeAlerts: preferences.emailTradeAlerts ?? false,
      securityAlertsEnabled: preferences.securityAlertsEnabled ?? true,
      emailSecurityAlerts: preferences.emailSecurityAlerts ?? true,
      pushEnabled: preferences.pushEnabled ?? false,
      pushTradeAlerts: preferences.pushTradeAlerts ?? true,
      pushMessageAlerts: preferences.pushMessageAlerts ?? true,
      followAlertsEnabled: preferences.followAlertsEnabled ?? true,
      emailFollowAlerts: preferences.emailFollowAlerts ?? false,
      pushFollowAlerts: preferences.pushFollowAlerts ?? true,
      maxAlerts: preferences.maxAlerts,
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const normalizeEditState = (state: typeof editState) => ({
    ...state,
    emailWishlistAlerts: state.wishlistAlertsEnabled ? state.emailWishlistAlerts : false,
    emailDecantAlerts: state.decantAlertsEnabled ? state.emailDecantAlerts : false,
    emailSecurityAlerts: state.securityAlertsEnabled ? state.emailSecurityAlerts : false,
    emailFollowAlerts: state.followAlertsEnabled ? state.emailFollowAlerts : false,
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const success = await onPreferencesChange(normalizeEditState(editState))
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
    setEditState(prev => {
      if (key === "wishlistAlertsEnabled") {
        const wishlistAlertsEnabled = !prev.wishlistAlertsEnabled
        return {
          ...prev,
          wishlistAlertsEnabled,
          emailWishlistAlerts: wishlistAlertsEnabled ? prev.emailWishlistAlerts : false,
        }
      }
      if (key === "decantAlertsEnabled") {
        const decantAlertsEnabled = !prev.decantAlertsEnabled
        return {
          ...prev,
          decantAlertsEnabled,
          emailDecantAlerts: decantAlertsEnabled ? prev.emailDecantAlerts : false,
        }
      }
      if (key === "securityAlertsEnabled") {
        const securityAlertsEnabled = !prev.securityAlertsEnabled
        return {
          ...prev,
          securityAlertsEnabled,
          emailSecurityAlerts: securityAlertsEnabled ? prev.emailSecurityAlerts : false,
        }
      }
      if (key === "followAlertsEnabled") {
        const followAlertsEnabled = !prev.followAlertsEnabled
        return {
          ...prev,
          followAlertsEnabled,
          emailFollowAlerts: followAlertsEnabled ? prev.emailFollowAlerts : false,
        }
      }
      return {
        ...prev,
        [key]: !prev[key],
      }
    })
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

                <VooDooCheck
                  id="security-alerts"
                  checked={editState.securityAlertsEnabled}
                  onChange={() => togglePreference("securityAlertsEnabled")}
                  labelChecked={t("securityAlerts")}
                  labelUnchecked={t("securityAlerts")}
                />

                <VooDooCheck
                  id="follow-alerts"
                  checked={editState.followAlertsEnabled}
                  onChange={() => togglePreference("followAlertsEnabled")}
                  labelChecked={t("followAlerts")}
                  labelUnchecked={t("followAlerts")}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-noir-gold flex items-center gap-2">
                <BsEnvelope className="h-4 w-4" />
                {t("emailNotifications")}
              </h4>

              <p className="text-xs text-noir-gold-100/80 ml-6">{t("emailRequiresInApp")}</p>

              <div className="space-y-2 ml-6">
                <VooDooCheck
                  id="email-wishlist-alerts"
                  checked={editState.emailWishlistAlerts}
                  disabled={!editState.wishlistAlertsEnabled}
                  onChange={() => togglePreference("emailWishlistAlerts")}
                  labelChecked={t("emailWishlistAlerts")}
                  labelUnchecked={t("emailWishlistAlerts")}
                />

                <VooDooCheck
                  id="email-decant-alerts"
                  checked={editState.emailDecantAlerts}
                  disabled={!editState.decantAlertsEnabled}
                  onChange={() => togglePreference("emailDecantAlerts")}
                  labelChecked={t("emailDecantAlerts")}
                  labelUnchecked={t("emailDecantAlerts")}
                />

                <VooDooCheck
                  id="email-trade-alerts"
                  checked={editState.emailTradeAlerts}
                  onChange={() => togglePreference("emailTradeAlerts")}
                  labelChecked={t("emailTradeAlerts")}
                  labelUnchecked={t("emailTradeAlerts")}
                />

                <VooDooCheck
                  id="email-security-alerts"
                  checked={editState.emailSecurityAlerts}
                  disabled={!editState.securityAlertsEnabled}
                  onChange={() => togglePreference("emailSecurityAlerts")}
                  labelChecked={t("emailSecurityAlerts")}
                  labelUnchecked={t("emailSecurityAlerts")}
                />

                <VooDooCheck
                  id="email-follow-alerts"
                  checked={editState.emailFollowAlerts}
                  disabled={!editState.followAlertsEnabled}
                  onChange={() => togglePreference("emailFollowAlerts")}
                  labelChecked={t("emailFollowAlerts")}
                  labelUnchecked={t("emailFollowAlerts")}
                />
              </div>
            </div>

            <PushNotificationSection
              preferences={preferences}
              isEditing
              isSaving={isSaving}
              editState={{
                pushEnabled: editState.pushEnabled,
                pushTradeAlerts: editState.pushTradeAlerts,
                pushMessageAlerts: editState.pushMessageAlerts,
                pushFollowAlerts: editState.pushFollowAlerts,
              }}
              onEditStateChange={patch => setEditState(prev => ({ ...prev, ...patch }))}
              onPreferencesChange={onPreferencesChange}
            />

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
                {t("alertPreferencesDescription")}
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

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("securityAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.securityAlertsEnabled ?? true} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("followAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.followAlertsEnabled ?? true} />
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
                      {t("emailTradeAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.emailTradeAlerts ?? false} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-noir-gold-100">
                      {t("emailSecurityAlerts")}
                    </span>
                    <StatusBadge enabled={preferences.emailSecurityAlerts ?? true} />
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

            <PushNotificationSection
              preferences={preferences}
              isEditing={false}
              isSaving={false}
              editState={{
                pushEnabled: preferences.pushEnabled ?? false,
                pushTradeAlerts: preferences.pushTradeAlerts ?? true,
                pushMessageAlerts: preferences.pushMessageAlerts ?? true,
                pushFollowAlerts: preferences.pushFollowAlerts ?? true,
              }}
              onEditStateChange={() => {}}
              onPreferencesChange={async () => false}
            />
          </div>
        )}
      </div>
    </VooDooDetails>
  )
}
