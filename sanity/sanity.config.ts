import { visionTool } from "@sanity/vision"
import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"

import { JOURNAL_LOCALE_LABELS, JOURNAL_LOCALES } from "../lib/sanity/locales"
import { apiVersion, dataset, projectId } from "./env"
import { schemaTypes } from "./schemaTypes"
import { structure } from "./structure"

/** Embedded Next route is `/studio`; hosted studio at *.sanity.studio uses `/`. */
const basePath =
  (typeof process !== "undefined" && process.env.SANITY_STUDIO_BASE_PATH?.trim()) ||
  "/studio"

export default defineConfig({
  name: "shadow-and-sillage",
  title: "perfumer's hollow — Behind the Bottle",
  projectId,
  dataset,
  apiVersion,
  basePath,
  plugins: [structureTool({ structure }), visionTool()],
  schema: {
    types: schemaTypes,
    templates: prev => [
      ...prev.filter(template => template.schemaType !== "article"),
      ...JOURNAL_LOCALES.map(locale => ({
        id: `article-${locale}`,
        title: `Article (${JOURNAL_LOCALE_LABELS[locale]})`,
        schemaType: "article" as const,
        value: { language: locale },
      })),
    ],
  },
})
