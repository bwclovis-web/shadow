import type { ChangeEvent } from "react"

import { SECTION_CLASS } from "./constants"
import { Field, inputClass } from "./Field"

export type ScraperSkipRulesSectionProps = {
  skipKeywordsRaw: string
  setSkipKeywordsRaw: (v: string) => void
}

export const ScraperSkipRulesSection = ({
  skipKeywordsRaw,
  setSkipKeywordsRaw,
}: ScraperSkipRulesSectionProps) => (
  <section className={SECTION_CLASS}>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      Skip rules
    </h2>

    <Field
      label="Skip keywords"
      hint="Comma-separated. Products whose names contain any of these words are skipped. Size patterns (30ml, 3.4 fl oz, etc.) are always skipped automatically."
    >
      <input
        className={inputClass()}
        value={skipKeywordsRaw}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSkipKeywordsRaw(e.target.value)}
      />
    </Field>
  </section>
)
