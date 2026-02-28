"use client"

import { useTranslations } from "next-intl"

import ChangePasswordForm from "@/components/Molecules/ChangePasswordForm/ChangePasswordForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"

type ChangePasswordPageClientProps = {
  bannerImage: string
}

const ChangePasswordPageClient = ({
  bannerImage,
}: ChangePasswordPageClientProps) => {
  const t = useTranslations("password")

  return (
    <section>
      <TitleBanner
        image={bannerImage}
        heading={t("changePassword")}
        subheading={t("updatePasswordToKeepAccountSecure")}
      />
      <div className="inner-container max-w-md mx-auto py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <ChangePasswordForm hideHeading />
        </div>
      </div>
    </section>
  )
}

export default ChangePasswordPageClient
