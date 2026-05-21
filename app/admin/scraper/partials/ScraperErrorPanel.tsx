import { Button } from "@/components/Atoms/Button/Button"

export type ScraperErrorPanelProps = {
  scrapeError: string
  connectionCheck: null | "checking" | "ok" | string
  onCheckConnection: () => void
}

export const ScraperErrorPanel = ({
  scrapeError,
  connectionCheck,
  onCheckConnection,
}: ScraperErrorPanelProps) => (
  <div className="mt-8 space-y-4 border border-noir-gold bg-noir-dark text-noir-gold-100">
    {connectionCheck === "ok" &&
      (scrapeError.includes("Failed to fetch") || scrapeError.includes("timed out")) && (
        <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Server is reachable — this was likely a timeout</p>
          <p className="mt-1 text-xs">
            The run took too long and the connection was closed before the server could respond. Use{" "}
            <strong>1–2 collection URLs only</strong> to test; if that works, run in smaller batches
            (e.g. one or two collection pages per run) so each run finishes in a few minutes.
          </p>
        </div>
      )}
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      <p className="font-semibold">Scraper error</p>
      <pre className="mt-1 whitespace-pre-wrap text-xs">{scrapeError}</pre>
      {scrapeError.toLowerCase().includes("invalid selector") && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Fix: use a valid CSS selector (no spaces/newlines, no :contains()). Inspect the collection
          page in DevTools and match the actual link structure — e.g. a[href*=&apos;/products/&apos;]
          for Shopify, or a[href*=&apos;/p/&apos;] for some other sites.
        </p>
      )}
    </div>
    <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
      <p className="font-semibold text-foreground">Troubleshooting</p>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
        <li>
          Confirm the dev server is running (e.g.{" "}
          <code className="rounded bg-muted px-1">npm run dev</code>) and check that terminal for
          errors.
        </li>
        <li>
          Use <strong>Check connection</strong> below to see if the API is reachable from this
          browser.
        </li>
        <li>
          If the run was long, the request may have timed out — try with fewer collection URLs (e.g.
          one page) first.
        </li>
        <li>
          Open{" "}
          <a
            href="/api/admin/scraper/health"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            /api/admin/scraper/health
          </a>{" "}
          in a new tab: you should see{" "}
          <code className="rounded bg-muted px-1">{"{ \"ok\": true }"}</code> when signed in as
          admin.
        </li>
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCheckConnection}
          disabled={connectionCheck === "checking"}
        >
          {connectionCheck === "checking" ? "Checking…" : "Check connection"}
        </Button>
        {connectionCheck === "ok" && (
          <span className="text-sm text-green-600 dark:text-green-400">
            Connection OK — server is reachable.
          </span>
        )}
        {connectionCheck && connectionCheck !== "checking" && connectionCheck !== "ok" && (
          <span className="text-sm text-destructive">Connection failed: {connectionCheck}</span>
        )}
      </div>
    </div>
  </div>
)
