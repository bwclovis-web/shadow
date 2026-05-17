import { getTranslations } from "next-intl/server"
import Link from "next/link"

const SiteFooter = async () => {
  const t = await getTranslations("siteFooter")

  return (
    <footer className="border-t border-noir-gold/20 bg-noir-black/80 py-8">
      <div className="inner-container flex flex-col items-center gap-3 text-center text-sm text-noir-gold-500 md:flex-row md:justify-between md:text-left">
        <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        <nav aria-label={t("navAria")} className="flex flex-wrap justify-center gap-4">
          <Link
            href="/community-policy"
            className="text-noir-gold hover:text-noir-light transition-colors"
          >
            {t("communityPolicy")}
          </Link>
          <Link
            href="/terms-and-conditions"
            className="text-noir-gold hover:text-noir-light transition-colors"
          >
            {t("terms")}
          </Link>
        </nav>
      </div>
    </footer>
  )
}

export default SiteFooter
