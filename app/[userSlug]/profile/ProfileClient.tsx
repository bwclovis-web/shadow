"use client"

import { getFormProps, getTextareaProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { Link } from "next-view-transitions"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useActionState, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import Input from "@/components/Atoms/Input/Input"
import RecommendedForYou from "@/components/Containers/Recommendations/RecommendedForYou"
import UserAlerts from "@/components/Containers/UserAlerts/UserAlerts"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import ImageUploader from "@/components/Molecules/ImageUploader/ImageUploader"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import CountryTypeahead from "@/components/Molecules/CountryTypeahead/CountryTypeahead"
import { uploadAvatarImage } from "@/utils/avatar-images-client"
import type { RecommendationPerfume } from "@/services/recommendations"
import type { SessionUser } from "@/utils/session-from-request.server"
import type { UserAlert, UserAlertPreferences } from "@/types/database"
import { PROFILE_LENGTH } from "@/utils/constants"
import { UpdateProfileSchema } from "@/utils/validation/formValidationSchemas"
import { getTranslatedError } from "@/utils/validation/formValidationSchemas"
import { queryKeys } from "@/lib/queries/user"
import { getUserDisplayName } from "@/utils/user"
import {
  updateProfileAction,
  type UpdateProfileActionState,
} from "./actions"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

type ProfileClientProps = {
  user: SessionUser
  alerts: UserAlert[]
  preferences: UserAlertPreferences | null
  unreadCount: number
  recommendedPerfumes: RecommendationPerfume[]
  bannerImage: string
}

const ProfileForm = ({
  user,
  formAction,
  lastResult,
}: {
  user: SessionUser
  formAction: (formData: FormData) => void
  lastResult?: unknown
}) => {
  const t = useTranslations("profile")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [avatarUrls, setAvatarUrls] = useState<string[]>(
    user.avatarImage ? [user.avatarImage] : []
  )

  useEffect(() => {
    setAvatarUrls(user.avatarImage ? [user.avatarImage] : [])
  }, [user.avatarImage])

  const [profileForm, { firstName, lastName, username, email, traderAbout, region, instagramHandle, fragranticaUrl, redditUsername }] =
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
        avatarImage: user.avatarImage ?? "",
        region: user.region ?? "",
        instagramHandle: user.instagramHandle ?? "",
        fragranticaUrl: user.fragranticaUrl ?? "",
        redditUsername: user.redditUsername ?? "",
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
      <input type="hidden" name="avatarImage" value={avatarUrls[0] ?? ""} />

      <div className="flex flex-col gap-1">
        <span className="block text-sm font-medium text-noir-gold-100">
          {t("avatarLabel")}
        </span>
        <p className="text-stone-400 text-sm" role="note">
          {t("avatarHint")}
        </p>
        <ImageUploader
          value={avatarUrls}
          onChange={setAvatarUrls}
          maxImages={1}
          uploadFn={uploadAvatarImage}
          translationNamespace="profile.avatar"
          cameraModalId="profile-avatar-camera"
        />
      </div>

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

      <CountryTypeahead
        name={region.name}
        defaultValue={(region.initialValue as string) || null}
      />
      {region.errors?.[0] ? (
        <p className="text-sm text-red-500">{getTranslatedError(region.errors, t)}</p>
      ) : null}

      <Input
        shading={true}
        inputId="instagramHandle"
        inputType="text"
        label={t("instagramHandle")}
        action={instagramHandle}
        inputRef={inputRef}
      />
      <p className="text-stone-400 text-sm -mt-2 mb-2" role="note">
        {t("instagramHint")}
      </p>

      <Input
        shading={true}
        inputId="redditUsername"
        inputType="text"
        label={t("redditUsername")}
        action={redditUsername}
        inputRef={inputRef}
      />
      <p className="text-stone-400 text-sm -mt-2 mb-2" role="note">
        {t("redditHint")}
      </p>

      <Input
        shading={true}
        inputId="fragranticaUrl"
        inputType="url"
        label={t("fragranticaUrl")}
        action={fragranticaUrl}
        inputRef={inputRef}
      />
      <p className="text-stone-400 text-sm -mt-2 mb-2" role="note">
        {t("fragranticaHint")}
      </p>

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
        size="lg"
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
  bannerImage,
}: ProfileClientProps) => {
  const t = useTranslations("profile")
  const queryClient = useQueryClient()
  const [state, formAction] = useActionState(
    updateProfileAction,
    null as UpdateProfileActionState
  )

  useEffect(() => {
    if (state?.success && state.user?.id) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.user.trader(state.user.id),
      })
    }
  }, [state?.success, state?.user?.id, queryClient])

  // Use the returned user after a successful save so the form shows saved data without a full refresh
  const displayUser = state?.user ?? user

  const hasSuccess = state?.success === true
  const hasErrors = state?.errors && Object.keys(state.errors).length > 0

  return (
    <main id="main-content">
      <TitleBanner
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <span className="block max-w-max rounded-md font-semibold text-noir-gold-500 mx-auto">
          {getUserDisplayName(displayUser)}
        </span>
      </TitleBanner>
      <PageWrapper className="grid grid-cols-1 lg:grid-cols-2 gap-6 inner-container">
        <div className="lg:col-span-1">
          <h2 className="text-2xl font-bold mb-4 text-noir-gold">
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

        <div id="user-alerts" className="lg:col-span-1 scroll-mt-24">
          <UserAlerts
            userId={user.id}
            initialAlerts={alerts}
            initialPreferences={preferences ?? undefined}
            initialUnreadCount={unreadCount}
          />
        </div>
      </PageWrapper>

      <section className="inner-container mt-6 mb-12">
        <RecommendedForYou perfumes={recommendedPerfumes} />
      </section>
    </main>
  )
}

export default ProfileClient
