import { useTranslations } from "next-intl"

import ContactTraderForm from "./ContactTraderForm"

interface ItemInfo {
  userPerfumeId: string
  perfumeName: string
  perfumeHouse?: string
  amount?: string
  price?: string
  tradePrice?: string
  tradePreference?: string
}

interface ContactTraderModalProps {
  recipientId: string
  recipientName?: string
  lastResult?: any
  onSubmit?: (formData: FormData) => Promise<void> | void
  onSuccess?: () => void
  itemInfo?: ItemInfo
  itemSubject?: string
}

const ContactTraderModal = ({
  recipientId,
  recipientName,
  lastResult,
  onSubmit,
  onSuccess,
  itemInfo,
  itemSubject,
}: ContactTraderModalProps) => {
  const t = useTranslations("contactTrader")

  const title = itemInfo
    ? t("itemTitle")
    : t("title")

  const heading = itemInfo
    ? t("itemTitle")
    : t("heading")

  const subheading = itemInfo
    ? t("itemSubheading", {
        perfumeName: itemInfo.perfumeName,
        perfumeHouse: itemInfo.perfumeHouse ? ` by ${itemInfo.perfumeHouse}` : "",
      })
    : recipientName
      ? t("subheading", { traderName: recipientName })
      : t("subheading")

  return (
    <div className="w-full p-6">
      <div className="flex flex-col items-start justify-between mb-4">
        <div>
          <h2>{heading}</h2>
          <p className="text-xl text-noir-gold-100">{subheading}</p>
        </div>
      </div>

      <ContactTraderForm
        recipientId={recipientId}
        recipientName={recipientName}
        lastResult={lastResult}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
        itemInfo={itemInfo}
        itemSubject={itemSubject}
      />
    </div>
  )
}

export default ContactTraderModal
