import type { ChangeEvent } from "react"

import HouseTypeahead from "@/components/Molecules/HouseTypeahead/HouseTypeahead"
import type { DiscoveryMode, ScraperSourcePreset } from "@/types/scraper"

import { SECTION_CLASS } from "./constants"
import { Field, inputClass } from "./Field"

export type ScraperHouseSectionProps = {
  houseName: string
  setHouseName: (v: string) => void
  discoveryMode: DiscoveryMode
  setDiscoveryMode: (v: DiscoveryMode) => void
  maxProducts: string
  setMaxProducts: (v: string) => void
  savedSources: ScraperSourcePreset[]
  onLoadPreset: (preset: ScraperSourcePreset) => void
  collectionUrlsRaw: string
  setCollectionUrlsRaw: (v: string) => void
  collectionUrlsHint: string | null
  sampleProductUrl: string
  setSampleProductUrl: (v: string) => void
  baseUrl: string
  setBaseUrl: (v: string) => void
  skipSizeVariants: boolean
  setSkipSizeVariants: (v: boolean) => void
  headed: boolean
  setHeaded: (v: boolean) => void
  etsyHeaded: boolean
  setEtsyHeaded: (v: boolean) => void
  delayBetweenUrlsMs: string
  setDelayBetweenUrlsMs: (v: string) => void
  retryAttempts: string
  setRetryAttempts: (v: string) => void
}

export const ScraperHouseSection = ({
  houseName,
  setHouseName,
  discoveryMode,
  setDiscoveryMode,
  maxProducts,
  setMaxProducts,
  savedSources,
  onLoadPreset,
  collectionUrlsRaw,
  setCollectionUrlsRaw,
  collectionUrlsHint,
  sampleProductUrl,
  setSampleProductUrl,
  baseUrl,
  setBaseUrl,
  skipSizeVariants,
  setSkipSizeVariants,
  headed,
  setHeaded,
  etsyHeaded,
  setEtsyHeaded,
  delayBetweenUrlsMs,
  setDelayBetweenUrlsMs,
  retryAttempts,
  setRetryAttempts,
}: ScraperHouseSectionProps) => (
  <section className={SECTION_CLASS}>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      House
    </h2>

    <Field label="House name *" hint="Search for an existing house or type a new one.">
      <HouseTypeahead name="_houseId" defaultName={houseName} onNameChange={setHouseName} />
    </Field>

    <Field
      label="URL discovery"
      hint="Auto tries sitemap, Shopify /products.json, and WooCommerce API before collection-page link scraping."
    >
      <select
        className={inputClass()}
        value={discoveryMode}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setDiscoveryMode(e.target.value as DiscoveryMode)
        }
      >
        <option value="auto">Auto</option>
        <option value="sitemap">Sitemap only</option>
        <option value="shopify">Shopify JSON</option>
        <option value="woocommerce">WooCommerce API</option>
        <option value="manual">Manual (collection selectors only)</option>
      </select>
    </Field>

    <Field label="Max products (discovery)" hint="Cap discovered URLs. Leave empty for no limit.">
      <input
        type="number"
        min={1}
        className={inputClass()}
        value={maxProducts}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setMaxProducts(e.target.value)}
        placeholder="e.g. 100"
      />
    </Field>

    {savedSources.length > 0 && (
      <Field label="Saved presets" hint="Load a previously saved scraper configuration.">
        <select
          className={inputClass()}
          defaultValue=""
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            const id = e.target.value
            if (!id) return
            const preset = savedSources.find(s => s.id === id)
            if (preset) onLoadPreset(preset)
          }}
        >
          <option value="">Select preset…</option>
          {savedSources.map(s => (
            <option key={s.id} value={s.id}>
              {s.houseName} ({s.platformType ?? "generic"})
            </option>
          ))}
        </select>
      </Field>
    )}

    <Field
      label="Collection URLs *"
      hint="One URL per line or comma-separated. Each must start with http:// or https://. All listed pages are visited."
    >
      <textarea
        className={inputClass("min-h-[100px] resize-y font-mono text-xs")}
        required
        value={collectionUrlsRaw}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCollectionUrlsRaw(e.target.value)}
        placeholder={
          "https://blackheartedtart.com/collections/perfumes\nhttps://blackheartedtart.com/collections/perfumes?page=2"
        }
      />
      {collectionUrlsHint ? (
        <p className="mt-1 text-xs text-muted-foreground">{collectionUrlsHint}</p>
      ) : null}
    </Field>

    <Field
      label="Sample product URL"
      hint="Optional: a single product page to reference when tuning selectors."
    >
      <input
        className={inputClass()}
        type="url"
        value={sampleProductUrl}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSampleProductUrl(e.target.value)}
        placeholder="https://blackheartedtart.com/products/50-ft-queenie"
      />
    </Field>

    <Field
      label="Base URL"
      hint="Used to convert relative links/images to absolute URLs. Usually the homepage."
    >
      <input
        className={inputClass()}
        type="url"
        value={baseUrl}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setBaseUrl(e.target.value)}
        placeholder="https://blackheartedtart.com"
      />
    </Field>

    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={skipSizeVariants}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSkipSizeVariants(e.target.checked)}
        className="mt-1"
      />
      <span className="text-sm">
        <strong>Skip size variants</strong> — When checked (default), products whose names contain a
        size measurement (e.g. <code className="rounded bg-muted px-0.5">100ml</code>,{" "}
        <code className="rounded bg-muted px-0.5">1.7 fl oz</code>) are skipped, assuming a size-free
        listing of the same product also exists. <strong>Uncheck</strong> when the site puts sizes in
        all product names — the scraper will collect everything and deduplicate by cleaned name,
        keeping the bare listing when both a sized and an unsized variant exist.
      </span>
    </label>
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={headed}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setHeaded(e.target.checked)}
        className="mt-1"
      />
      <span className="text-sm">
        <strong>Open visible browser</strong> — Use when a site blocks headless Chrome (e.g. thoo.it
        returns 403). A visible Chrome window will open. If you still get 403, install{" "}
        <code className="rounded bg-muted px-0.5">undetected-chromedriver</code> and run again. Run
        locally; leave unchecked on a server.
      </span>
    </label>
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={etsyHeaded}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setEtsyHeaded(e.target.checked)}
        className="mt-1"
      />
      <span className="text-sm">
        <strong>Etsy: open browser window</strong> — Use when Etsy shows CAPTCHA. A visible Chrome
        window will open so you can solve it. Run locally (e.g.{" "}
        <code className="rounded bg-muted px-0.5">npm run dev</code>); leave unchecked on a server.
      </span>
    </label>
    <div className="mt-3 flex flex-wrap items-center gap-4">
      <Field
        label="Delay between collection URLs (ms)"
        hint="e.g. 5000 for Lush to avoid ERR_CONNECTION_RESET. Leave empty for no delay."
      >
        <input
          type="number"
          min={0}
          step={1000}
          placeholder="none"
          className={inputClass()}
          value={delayBetweenUrlsMs}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDelayBetweenUrlsMs(e.target.value)}
        />
      </Field>
      <Field
        label="Retry attempts per page"
        hint="Retries when a page fails to load (e.g. connection reset). Leave empty for no retries."
      >
        <input
          type="number"
          min={1}
          max={10}
          placeholder="1"
          className={inputClass()}
          value={retryAttempts}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setRetryAttempts(e.target.value)}
        />
      </Field>
    </div>
  </section>
)
