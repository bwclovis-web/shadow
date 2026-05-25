import { useTranslations } from "next-intl"

const RatingLabel = ({
  showLabel,
  currentValue,
  category,
  emphasized = false,
}: {
  showLabel: boolean
  currentValue: number
  category: "longevity" | "sillage" | "gender" | "priceValue" | "overall"
  emphasized?: boolean
}) => {
  const t = useTranslations("singlePerfume.rating")
  if (!showLabel) {
    return null
  }

  return (
    <span
      className={`text-xs font-medium tracking-wider transition-[color,transform,letter-spacing] duration-300 ease-out ${
        emphasized
          ? "text-noir-gold scale-[1.03] tracking-[0.18em]"
          : "text-noir-gold-500"
      }`}
    >
      {currentValue > 0
        ? t(`labels.${category}.${currentValue}`)
        : t("selectRating")}
    </span>
  )
}

export default RatingLabel
