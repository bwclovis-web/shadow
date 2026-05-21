import { Button } from "@/components/Atoms/Button/Button"

export type ScraperFormActionsProps = {
  scraping: boolean
  houseName: string
  onSavePreset: () => void
}

export const ScraperFormActions = ({
  scraping,
  houseName,
  onSavePreset,
}: ScraperFormActionsProps) => (
  <div className="flex flex-wrap gap-2">
    <Button type="submit" variant="primary" disabled={scraping}>
      {scraping ? "Running scraper…" : "Run scraper"}
    </Button>
    <Button
      type="button"
      variant="secondary"
      disabled={!houseName.trim() || scraping}
      onClick={onSavePreset}
    >
      Save preset
    </Button>
  </div>
)
