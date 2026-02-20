import { useTranslation } from "react-i18next"

const RatingLabel = ({
  showLabel,
  currentValue,
  category,
}: {
  showLabel: boolean
  currentValue: number
  category: "longevity" | "sillage" | "gender" | "priceValue" | "overall"
}) => {
  const { t } = useTranslation()
  if (!showLabel) {
    return null
  }

  return (
    <span className="text-xs text-noir-gold-500 font-medium">
      {currentValue > 0
        ? t(`singlePerfume.rating.labels.${category}.${currentValue}`)
        : t("singlePerfume.rating.selectRating")}
    </span>
  )
}

export default RatingLabel
