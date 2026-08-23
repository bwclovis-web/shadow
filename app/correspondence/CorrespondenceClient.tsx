"use client"

import { useRef } from "react"
import { useTranslations } from "next-intl"

import PendingSubmissionModal from "@/components/Containers/Forms/PendingSubmissionModal"
import ContactUsForm from "@/components/Containers/Forms/ContactUsForm"
import { Button } from "@/components/Atoms/Button/Button"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useSessionStore } from "@/hooks/sessionStore"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/new/contact.webp"

const CorrespondenceClient = () => {
  const t = useTranslations("contactUs")
  const { toggleModal } = useSessionStore()
  const perfumeButtonRef = useRef<HTMLButtonElement>(null)
  const houseButtonRef = useRef<HTMLButtonElement>(null)

  const handleOpenPerfumeModal = () => {
    if (perfumeButtonRef.current) {
      toggleModal(perfumeButtonRef, "pending-submission-perfume")
    }
  }

  const handleOpenHouseModal = () => {
    if (houseButtonRef.current) {
      toggleModal(houseButtonRef, "pending-submission-perfume_house")
    }
  }

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <PageWrapper>
        <div className="max-w-4xl mx-auto md:px-4 md:max-w-full">
          <div className="max-w-none">
            <div className="flex flex-col lg:flex-row gap-6">
              <section className="flex flex-col gap-6 border-b-4 lg:border-r-4 border-double border-noir-gold lg:px-6 pb-6 lg:pb-0 lg:border-b-0 lg:w-[min(100%,24rem)] lg:shrink-0">
                <h2>{t("contact.title")}</h2>
                <div className="flex flex-col gap-4 text-noir-light leading-relaxed text-lg">
                  <p>{t("contact.description")}</p>
                  <ContactUsForm />
                </div>
              </section>

              <section className="flex flex-col gap-6 min-w-0 flex-1">
                <h2>{t("faq.title")}</h2>
                <div className="flex flex-col gap-8">
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <div
                      key={num}
                      className="flex flex-col gap-3 border-b border-noir-gold/30 pb-6"
                    >
                      <h3 className="text-noir-gold text-xl font-semibold">
                        {t(`faq.question${num}`)}
                      </h3>
                      <p className="text-noir-light leading-relaxed text-lg">
                        {t(`faq.answer${num}`)}
                      </p>
                      {num === 2 && (
                        <p className="text-noir-light leading-relaxed text-lg">
                          {t("faq.answer2GuideLink")}{" "}
                          <PrefetchLink
                            href="/the-collectors-guide"
                            className="text-noir-gold underline underline-offset-4 hover:text-noir-light"
                          >
                            {t("faq.answer2GuideLinkCta")}
                          </PrefetchLink>
                        </p>
                      )}
                      {num === 3 && (
                        <p className="text-noir-light leading-relaxed text-lg">
                          <PrefetchLink
                            href="/privacy"
                            className="text-noir-gold underline underline-offset-4 hover:text-noir-light"
                          >
                            {t("faq.answer3PrivacyLink")}
                          </PrefetchLink>
                        </p>
                      )}
                      {num === 1 && (
                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                          <Button
                            ref={perfumeButtonRef}
                            onClick={handleOpenPerfumeModal}
                            variant="secondary"
                            className="max-w-max"
                          >
                            {t("faq.submitPerfumeButton")}
                          </Button>
                          <Button
                            ref={houseButtonRef}
                            onClick={handleOpenHouseModal}
                            variant="secondary"
                            className="max-w-max"
                          >
                            {t("faq.submitHouseButton")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </PageWrapper>
      <PendingSubmissionModal submissionType="perfume" />
      <PendingSubmissionModal submissionType="perfume_house" />
    </main>
  )
}

export default CorrespondenceClient
