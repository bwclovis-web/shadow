"use client"

import { useRef } from "react"
import { useTranslations } from "next-intl"

import PendingSubmissionModal from "@/components/Containers/Forms/PendingSubmissionModal"
import { Button } from "@/components/Atoms/Button/Button"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useSessionStore } from "@/hooks/sessionStore"

const BANNER_IMAGE = "/images/contact.webp"

const ContactUsClient = () => {
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
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <article className="inner-container py-12">
        <div className="max-w-4xl mx-auto md:px-4 md:max-w-full">
          <div className="prose prose-lg prose-invert max-w-none">
            <div className="flex flex-col lg:flex-row gap-12">
              {/* Contact Section */}
              <section className="flex flex-col gap-6 border-b-4 lg:border-r-4 border-double border-noir-gold lg:px-6 pb-10 lg:pb-0 lg:border-b-0">
                <h2 className="text-noir-gold text-3xl font-bold mb-4">
                  {t("contact.title")}
                </h2>
                <div className="flex flex-col gap-4 text-noir-light leading-relaxed text-lg">
                  <p>{t("contact.description")}</p>
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold text-noir-gold">
                      {t("contact.emailLabel")}
                    </p>
                    <a
                      href={`mailto:${t("contact.email")}`}
                      className="text-noir-gold hover:text-noir-light transition-colors"
                    >
                      {t("contact.email")}
                    </a>
                  </div>
                </div>
              </section>

              {/* FAQ Section */}
              <section className="flex flex-col gap-6">
                <h2 className="text-noir-gold text-3xl font-bold mb-4">
                  {t("faq.title")}
                </h2>
                <div className="flex flex-col gap-8">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <div key={num} className="flex flex-col gap-3 border-b border-noir-gold/30 pb-6">
                      <h3 className="text-noir-gold text-xl font-semibold">
                        {t(`faq.question${num}`)}
                      </h3>
                      <p className="text-noir-light leading-relaxed text-lg">
                        {t(`faq.answer${num}`)}
                      </p>
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
      </article>

      <PendingSubmissionModal submissionType="perfume" />
      <PendingSubmissionModal submissionType="perfume_house" />
    </section>
  )
}

export default ContactUsClient
