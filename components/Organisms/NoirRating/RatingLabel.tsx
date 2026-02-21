import { useTranslations } from "next-intl"

const RatingLabel = ({
  showLabel,
  currentValue,
  category,
}: {
  showLabel: boolean
  currentValue: number
  category: "longevity" | "sillage" | "gender" | "priceValue" | "overall"
}) => {
  const t = useTranslations("singlePerfume.rating")
  if (!showLabel) {
    return null
  }

  return (
    <span className="text-xs text-noir-gold-500 font-medium">
      {currentValue > 0
        ? t(`labels.${category}.${currentValue}`)
        : t("selectRating")}
    </span>
  )
}

export default RatingLabel
