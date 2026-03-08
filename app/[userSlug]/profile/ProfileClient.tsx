"use client"

import { getFormProps, getTextareaProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { Link } from "next-view-transitions"
import { useRef, useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import Input from "@/components/Atoms/Input/Input"
import RecommendedForYou from "@/components/Containers/Recommendations/RecommendedForYou"
import UserAlerts from "@/components/Containers/UserAlerts/UserAlerts"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { RecommendationPerfume } from "@/services/recommendations"
import type { SafeUser } from "@/types"
import type { UserAlert, UserAlertPreferences } from "@/types/database"
import { PROFILE_LENGTH } from "@/utils/constants"
import { UpdateProfileSchema } from "@/utils/validation/formValidationSchemas"
import { getTranslatedError } from "@/utils/validation/formValidationSchemas"
import { getUserDisplayName } from "@/utils/user"
import {
  updateProfileAction,
  type UpdateProfileActionState,
} from "./actions"

const BANNER_IMAGE = "/images/myprofile.webp"

type ProfileClientProps = {
  user: SafeUser
  alerts: UserAlert[]
  preferences: UserAlertPreferences | null
  unreadCount: number
  recommendedPerfumes: RecommendationPerfume[]
}

const ProfileForm = ({
  user,
  formAction,
  lastResult,
}: {
  user: SafeUser
  formAction: (formData: FormData) => void
  lastResult?: unknown
}) => {
  const t = useTranslations("profile")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [profileForm, { firstName, lastName, username, email, traderAbout }] =
    useForm({
      id: "profile-form",
      lastResult: lastResult ?? undefined,
      constraint: getZodConstraint(UpdateProfileSchema),
      onValidate: ({ formData }) =>
        parseWithZod(formData, { schema: UpdateProfileSchema }),
      shouldValidate: "onBlur",
      shouldRevalidate: "onInput",
      defaultValue: {
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        username: user.username ?? "",
        email: user.email ?? "",
        traderAbout: user.traderAbout ?? "",
      },
    })

  return (
    <form
      {...getFormProps(profileForm)}
      action={formAction}
      className="space-y-4 noir-border p-6 relative"
    >
      <CSRFToken />
      <input type="hidden" name="userId" value={user.id} />

      <Input
        shading={true}
        inputId="firstName"
        inputType="text"
        label={t("firstName")}
        action={firstName}
        inputRef={inputRef}
      />

      <Input
        shading={true}
        inputId="lastName"
        inputType="text"
        label={t("lastName")}
        action={lastName}
        inputRef={inputRef}
      />

      <Input
        shading={true}
        inputId="username"
        inputType="text"
        label={t("username")}
        action={username}
        inputRef={inputRef}
      />
      <p className="text-stone-400 text-sm -mt-2 mb-2" role="note">
        {t("usernameHint")}
      </p>

      <Input
        shading={true}
        inputId="email"
        inputType="email"
        label={t("email")}
        action={email}
        inputRef={inputRef}
      />

      <div className="flex flex-col gap-1">
        <label
          htmlFor={traderAbout.id}
          className="block text-sm font-medium text-noir-gold-100"
        >
          {t("traderAbout")}
        </label>
        <textarea
          {...getTextareaProps(traderAbout, { ariaAttributes: true })}
          rows={4}
          maxLength={PROFILE_LENGTH}
          className="block w-full rounded-md border border-stone-600 bg-stone-800 px-3 py-2 text-noir-gold-100 shadow-inner placeholder:text-stone-500 focus:border-noir-gold-500 focus:outline-none focus:ring-1 focus:ring-noir-gold-500"
          placeholder={t("traderAboutPlaceholder")}
        />
        <p className="text-stone-400 text-sm" role="note">
          {t("traderAboutHint", { max: PROFILE_LENGTH })}
        </p>
        {traderAbout.errors?.[0] && (
          <p id={`${traderAbout.id}-error`} className="text-sm text-red-500">
            {traderAbout.errors[0] === "validation.profileAboutMax"
              ? t("validation.profileAboutMax", { max: PROFILE_LENGTH })
              : getTranslatedError(traderAbout.errors, t)}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        background="gold"
        size="xl"
        className="w-full"
      >
        {t("updateProfile")}
      </Button>

      <div className="mt-6 pt-6 border-t border-stone-600">
        <p className="text-stone-400 text-sm mb-2">
          {t("scentPreferencesHint")}
        </p>
        <Button variant="secondary" size="md">
          <Link href="/scent-quiz">{t("scentQuizLink")}</Link>
        </Button>
      </div>
    </form>
  )
}

const ProfileClient = ({
  user,
  alerts,
  preferences,
  unreadCount,
  recommendedPerfumes,
}: ProfileClientProps) => {
  const t = useTranslations("profile")
  const [state, formAction] = useActionState(
    updateProfileAction,
    null as UpdateProfileActionState
  )

  // Use the returned user after a successful save so the form shows saved data without a full refresh
  const displayUser = (state?.user ?? user) as SafeUser

  const hasSuccess = state?.success === true
  const hasErrors = state?.errors && Object.keys(state.errors).length > 0

  return (
    <>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <span className="block max-w-max rounded-md font-semibold text-noir-gold-500 mx-auto">
          {getUserDisplayName(displayUser)}
        </span>
      </TitleBanner>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 inner-container">
        <div className="lg:col-span-1">
          <h2 className="text-2xl font-bold mb-6 text-noir-gold">
            {t("updateProfile")}
          </h2>
          {hasSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {t("profileUpdatedSuccessfully")}
            </div>
          )}
          {hasErrors && state?.errors?.general?.[0] && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {state.errors.general[0]}
            </div>
          )}
          <ProfileForm
            key={state?.user ? "saved" : (user as { updatedAt?: Date }).updatedAt?.toString() ?? user.id}
            user={displayUser}
            formAction={formAction}
            lastResult={state?.submission}
          />
        </div>

        <div className="lg:col-span-1">
          <UserAlerts
            userId={user.id}
            initialAlerts={alerts}
            initialPreferences={preferences ?? undefined}
            initialUnreadCount={unreadCount}
          />
        </div>
      </section>

      <section className="inner-container mt-12">
        <RecommendedForYou perfumes={recommendedPerfumes} />
      </section>
    </>
  )
}

export default ProfileClient
