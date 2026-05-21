import Image from "next/image"
import { getTranslations } from "next-intl/server"

import TitleBanner from "@/components/Organisms/TitleBanner"
import PageWrapper from "@/components/Containers/Pagewrapper/PageWrapper"

const IMAGES = {
  banner: "/images/work.webp",
  match: "/images/match.webp",
  decant: "/images/decant.webp",
  wishlist: "/images/workWish.webp",
  trade: "/images/workTrade.webp",
  leftBehind: "/images/left.webp",
} as const

const SECTION_IMG_CLASS =
  "w-full mb-5 md:mb-10 lg:w-3/4 xl:w-1/2 max-w-4xl aspect-[5/4] rounded-xl bg-transparent border-2 lg:border-8 border-noir-light shadow-lg shadow-black filter grayscale-[10%] contrast-[1] brightness-[0.9] sepia-[0.5] mix-blend-overlay"
const IMAGE_SIZES =
  "(min-width: 1440px) 55vw, (min-width: 1024px) 65vw, 80vw"

const HowWeWorkContent = async () => {
  const t = await getTranslations("howItWorks")

  return (
    <main>
      <TitleBanner
        image={IMAGES.banner}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <PageWrapper>
        <article className="mx-auto">
          <div className="prose prose-lg prose-invert gap-10 flex flex-col">
            <section className="gap-6 flex flex-col lg:flex-row border-b border-noir-gold pb-10 items-center">
              <Image
                src={IMAGES.match}
                alt=""
                width={840}
                height={840}
                className={SECTION_IMG_CLASS}
                sizes={IMAGE_SIZES}
                objectFit="cover"
              />
              <div className="flex flex-col gap-6 lg:w-1/2">
                <h2 className="md:mb-1">{t("section1.title")}</h2>
                <p className="text-noir-light text-lg mb-2 leading-relaxed">
                  {t("section1.content")}
                </p>
                <p className="text-noir-light text-lg mb-4 leading-relaxed">
                  {t("section1.content2")}
                </p>
              </div>
            </section>

            <section className="gap-6 flex flex-col lg:flex-row-reverse border-b border-noir-gold lg:pb-10 pb-4 items-center">
              <Image
                src={IMAGES.decant}
                alt=""
                width={1040}
                height={840}
                className={SECTION_IMG_CLASS}
                sizes="(min-width: 1440px) 55vw, (min-width: 1024px) 65vw, 90vw"
                objectFit="cover"
              />
              <div className="flex flex-col gap-6 lg:w-1/2">
                <h2 className="md:mb-1">{t("section2.title")}</h2>
                <p className="text-noir-light text-lg leading-relaxed mb-2">
                  {t("section2.content")}
                </p>
                <p className="text-noir-light text-lg leading-relaxed mb-4">
                  {t("section2.content2")}
                </p>
              </div>
            </section>

            <section className="gap-6 flex flex-col lg:flex-row border-b border-noir-gold lg:pb-10 pb-4 items-center">
              <Image
                src={IMAGES.wishlist}
                alt=""
                width={1040}
                height={840}
                className={`${SECTION_IMG_CLASS} brightness-[1.1]`}
                sizes="(min-width: 1440px) 55vw, (min-width: 1024px) 65vw, 90vw"
                objectFit="cover"
              />
              <div className="flex flex-col gap-6 lg:w-1/2">
                <h2 className="md:mb-1">{t("section3.title")}</h2>
                <p className="text-noir-light text-lg leading-relaxed mb-2">
                  {t("section3.content")}
                </p>
                <p className="text-noir-light text-lg leading-relaxed mb-4">
                  {t("section3.content2")}
                </p>
              </div>
            </section>

            <section className="gap-6 flex flex-col lg:flex-row-reverse border-b border-noir-gold lg:pb-10 pb-4 items-center">
              <Image
                src={IMAGES.trade}
                alt=""
                width={1040}
                height={840}
                className={SECTION_IMG_CLASS}
                sizes="(min-width: 1440px) 55vw, (min-width: 1024px) 65vw, 90vw"
                objectFit="cover"
              />
              <div className="flex flex-col gap-6 lg:w-1/2">
                <h2 className="md:mb-1">{t("section4.title")}</h2>
                <p className="text-noir-light text-lg leading-relaxed mb-2">
                  {t("section4.content")}
                </p>
                <p className="text-noir-light text-lg leading-relaxed mb-4">
                  {t("section4.content2")}
                </p>
              </div>
            </section>

            <section className="gap-6 flex flex-col lg:flex-row border-b border-noir-gold lg:pb-10 pb-4  items-center">
              <Image
                src={IMAGES.leftBehind}
                alt=""
                width={1040}
                height={840}
                className={`${SECTION_IMG_CLASS} sepia-[0.9]`}
                sizes="(min-width: 1440px) 55vw, (min-width: 1024px) 65vw, 90vw"
                objectFit="cover"
              />
              <div className="flex flex-col gap-6 lg:w-1/2">
                <h2 className="md:mb-1">{t("section5.title")}</h2>
                  <p className="text-noir-light text-lg leading-relaxed mb-4">
                  {t("section5.content")}
                </p>
              </div>
            </section>
          </div>
        </article>
      </PageWrapper>
    </main>
  )
}

export default HowWeWorkContent
