import type { ChangeEvent } from "react"

import { SECTION_CLASS } from "./constants"
import { Field, inputClass } from "./Field"

export type ScraperSelectorsSectionProps = {
  productLinkSelector: string
  setProductLinkSelector: (v: string) => void
  nameSelector: string
  setNameSelector: (v: string) => void
  descriptionSelector: string
  setDescriptionSelector: (v: string) => void
  notesSelector: string
  setNotesSelector: (v: string) => void
  imageSelector: string
  setImageSelector: (v: string) => void
}

export const ScraperSelectorsSection = ({
  productLinkSelector,
  setProductLinkSelector,
  nameSelector,
  setNameSelector,
  descriptionSelector,
  setDescriptionSelector,
  notesSelector,
  setNotesSelector,
  imageSelector,
  setImageSelector,
}: ScraperSelectorsSectionProps) => (
  <section className={SECTION_CLASS}>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      CSS Selectors
    </h2>
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Selector tips (avoid &quot;invalid selector&quot; errors)
      </summary>
      <ul className="mt-2 list-inside list-disc space-y-1 pl-1">
        <li>
          Use standard CSS only — no <code className="rounded bg-muted px-0.5">:contains()</code> or
          jQuery-only selectors.
        </li>
        <li>
          Product link selector must match links on the collection page (e.g.{" "}
          <code className="rounded bg-muted px-0.5">a[href*=&apos;/products/&apos;]</code>). Inspect
          the page to see the real <code className="rounded bg-muted px-0.5">href</code> pattern.
        </li>
        <li>No newlines or extra spaces inside a selector.</li>
      </ul>
    </details>

    <Field
      label="Product link selector *"
      hint="Valid CSS only (no :contains()). Use a[href*='/products/'] (Shopify), a[href*='/product/'] (thoo.it, WooCommerce), or a[href*='/p/']. Inspect the collection page to see the link href pattern."
    >
      <input
        className={inputClass("font-mono text-xs")}
        required
        value={productLinkSelector}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setProductLinkSelector(e.target.value)}
        placeholder="a[href*='/products/']"
      />
    </Field>

    <Field label="Product name selector *" hint="Element containing the product name.">
      <input
        className={inputClass("font-mono text-xs")}
        required
        value={nameSelector}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setNameSelector(e.target.value)}
      />
    </Field>

    <Field label="Description selector *" hint="Element containing the product description.">
      <input
        className={inputClass("font-mono text-xs")}
        required
        value={descriptionSelector}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDescriptionSelector(e.target.value)}
      />
    </Field>

    <Field
      label="Notes selector (optional)"
      hint="Element containing fragrance notes. If blank, the description selector text is used for note extraction."
    >
      <input
        className={inputClass("font-mono text-xs")}
        value={notesSelector}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setNotesSelector(e.target.value)}
        placeholder="Leave blank to use description"
      />
    </Field>

    <Field
      label="Image selector *"
      hint="CSS for the main product image. For PhotoSwipe galleries use .pswp__zoom-wrap .pswp__img (scraper will open the lightbox to capture the full-size image)."
    >
      <input
        className={inputClass("font-mono text-xs")}
        required
        value={imageSelector}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setImageSelector(e.target.value)}
      />
    </Field>
  </section>
)
