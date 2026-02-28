import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"

export const ROUTE_PATH = "/terms-and-conditions"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("termsAndConditions.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const TermsAndConditionsPage = async () => {
  const t = await getTranslations("termsAndConditions")
  return (
    <article>
      <TitleBanner
        imagePos="object-center"
        image="/images/terms.webp"
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">1. {t("gist.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("gist.contentOne")}</p>
          <p>{t("gist.contentTwo")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">2. {t("tradingAndListing.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("tradingAndListing.contentOne")}</p>
          <p>{t("tradingAndListing.contentTwo")}</p>
          <p>{t("tradingAndListing.contentThree")}</p>
          <p>{t("tradingAndListing.contentFour")}</p>
          <p>{t("tradingAndListing.contentFive")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">3. {t("accountsAndConduct.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("accountsAndConduct.contentOne")}</p>
          <p>{t("accountsAndConduct.contentTwo")}</p>
          <p>{t("accountsAndConduct.contentThree")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">4. {t("reviewsAndNotes.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("reviewsAndNotes.contentOne")}</p>
          <p>{t("reviewsAndNotes.contentTwo")}</p>
          <p>{t("reviewsAndNotes.contentThree")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">5. {t("noGuarantee.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("noGuarantee.contentOne")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">6. {t("liability.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("liability.contentOne")}</p>
          <p>{t("liability.contentTwo")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">7. {t("privacy.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("privacy.contentOne")}</p>
        </div>
        <ul className="list-disc list-inside text-noir-gold-100 text-lg">
          <li>{t("privacy.contentList.one")}</li>
          <li>{t("privacy.contentList.two")}</li>
          <li>{t("privacy.contentList.three")}</li>
          <li>{t("privacy.contentList.four")}</li>
          <li>{t("privacy.contentList.five")}</li>
        </ul>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">8. {t("changes.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("changes.contentOne")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold mb-20">
        <h2 className="mb-4">9. {t("closing.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("closing.contentOne")}</p>
        </div>
      </section>
    </article>
  )
}

export default TermsAndConditionsPage
