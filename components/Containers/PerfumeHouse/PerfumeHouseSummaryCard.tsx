import { Button } from "~/components/Atoms/Button"
import PerfumeHouseAddressBlock from "~/components/Containers/PerfumeHouse/AddressBlock/PerfumeHouseAddressBlock"
import { useTranslation } from "react-i18next"
interface PerfumeHouseSummaryCardProps {
  perfumeHouse: any
  totalPerfumeCount: number
  selectedLetter?: string | null
  onBackClick: () => void
}

const PerfumeHouseSummaryCard = ({
  perfumeHouse,
  totalPerfumeCount,
  selectedLetter,
  onBackClick,
}: PerfumeHouseSummaryCardProps) => {
  const { t } = useTranslation()
  return(
    <div className="noir-border relative bg-white/5 text-noir-gold-500">
      <PerfumeHouseAddressBlock perfumeHouse={perfumeHouse} />
      {perfumeHouse.description && (
        <p className="px-4 pt-4">{perfumeHouse.description}</p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-4 pt-4">
        <span className="text-xs uppercase tracking-[0.3em] text-noir-gold-500">
          {t("perfumeHouse.summaryCard.totalPerfumeCount", {
            defaultValue: "Total perfumes",
          })}
        </span>
        <span
          className="text-2xl font-semibold text-noir-gold"
          data-testid="perfume-count"
        >
          {totalPerfumeCount}
        </span>
      </div>
      <span className="tag absolute">{perfumeHouse.type}</span>
      <Button
        onClick={onBackClick}
        variant="primary"
        background="gold"
        size="sm"
        className="gap-2 max-w-max ml-2 mb-2 mt-2"
        aria-label={
          selectedLetter
            ? t("perfumeHouse.summaryCard.ariaLabel", {
              defaultValue: "Back to houses starting with {{selectedLetter}}",
              selectedLetter: selectedLetter || "Houses",
            })
            : t("perfumeHouse.summaryCard.backToHousesLabel", {
              defaultValue: "Back to houses",
            })
        }
      >
        ← {t("perfumeHouse.summaryCard.backToHouses", {
          defaultValue: "Back to houses",
          selectedLetter: selectedLetter || "Houses",
        })}
      </Button>
    </div>
  )}

export default PerfumeHouseSummaryCard


