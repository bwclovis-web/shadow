import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import ContactUsClient from "./ContactUsClient"

export const ROUTE_PATH = "/contact-us"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("contactUs.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const ContactUsPage = () => <ContactUsClient />

export default ContactUsPage
