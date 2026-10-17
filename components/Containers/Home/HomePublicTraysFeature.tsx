"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"

import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import { PUBLIC_TRAYS_PATH } from "@/constants/routes"

type HomePublicTraysFeatureProps = {
  enabled: boolean
}

const HomePublicTraysFeature = ({
  enabled,
}: HomePublicTraysFeatureProps) => {
  const t = useTranslations("home.galleryWalk.publicTrays")

  if (!enabled) return null

  return (
    <section
      className="bg-noir-black py-5 lg:py-6"
      aria-labelledby="home-public-trays-heading"
    >
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10">
        <div className="noir-border relative grid bg-noir-black before:z-10 after:z-10 md:min-h-[280px] md:grid-cols-[55fr_45fr]">
          <div className="relative overflow-hidden border-b border-noir-gold/40 md:border-r md:border-b-0">
            <Image
              src="/images/new/public-trays.webp"
              alt=""
              width={1916}
              height={821}
              loading="lazy"
              className="h-auto w-full md:absolute md:inset-0 md:h-full md:object-cover"
              sizes="(min-width: 80rem) 660px, (min-width: 48rem) 55vw, 100vw"
            />
          </div>
          <div className="flex flex-col items-start justify-center gap-3 p-5 sm:p-6 lg:px-8">
            <h2
              id="home-public-trays-heading"
              className="!text-[clamp(2.5rem,4.2vw,3.75rem)] !font-semibold !leading-none"
            >
              {t("title")}
            </h2>
            <p className="font-headline text-[1.625rem] leading-snug text-noir-light lg:text-[1.875rem]">
              {t("description")}
            </p>
            <p className="text-[0.9375rem] leading-relaxed text-noir-light/75 lg:text-base">
              {t("details")}
            </p>
            <VooDooLink
              url={PUBLIC_TRAYS_PATH}
              variant="primary"
              background="gold"
              size="sm"
              className="mt-2"
            >
              {t("cta")}
            </VooDooLink>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomePublicTraysFeature
