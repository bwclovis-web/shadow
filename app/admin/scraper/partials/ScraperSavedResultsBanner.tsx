import { Button } from "@/components/Atoms/Button/Button"
import type { ScraperRunResponse } from "@/types/scraper"

export type ScraperSavedResultsBannerProps = {
  savedScrapeResult: ScraperRunResponse
  onRestore: () => void
  onClear: () => void
}

export const ScraperSavedResultsBanner = ({
  savedScrapeResult,
  onRestore,
  onClear,
}: ScraperSavedResultsBannerProps) => (
  <div className="mt-8 rounded-lg border border-green-600/50 bg-green-950/20 p-4 text-sm text-green-800 dark:text-green-200">
    <p className="font-medium">Previous scrape results saved</p>
    <p className="mt-1 text-xs text-muted-foreground">
      You have results from a previous run ({savedScrapeResult.scrapedCount} products). Restore them
      to confirm & import without re-running the scraper.
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" variant="primary" size="sm" onClick={onRestore}>
        Restore previous results
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onClear}>
        Clear saved results
      </Button>
    </div>
  </div>
)
