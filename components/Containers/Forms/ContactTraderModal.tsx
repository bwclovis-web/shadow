import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()

  const title = itemInfo
    ? t("contactTrader.itemTitle", "Inquire About Item")
    : t("contactTrader.title", "Contact Trader")

  const heading = itemInfo
    ? t("contactTrader.itemTitle", "Inquire About Item")
    : t("contactTrader.heading", "Contact Trader")

  const subheading = itemInfo
    ? t(
        "contactTrader.itemSubheading",
        {
          perfumeName: itemInfo.perfumeName,
          perfumeHouse: itemInfo.perfumeHouse ? ` by ${itemInfo.perfumeHouse}` : "",
        },
        `Contact the trader about ${itemInfo.perfumeName}${itemInfo.perfumeHouse ? ` by ${itemInfo.perfumeHouse}` : ""}.`
      )
    : recipientName
      ? t(
          "contactTrader.subheading",
          { traderName: recipientName },
          `Contact ${recipientName} to inquire about trading.`
        )
      : t("contactTrader.subheading", "Contact the trader to inquire about the item.")

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
