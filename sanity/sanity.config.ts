import { visionTool } from "@sanity/vision"
import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"

import { apiVersion, dataset, projectId } from "./env"
import { schemaTypes } from "./schemaTypes"
import { structure } from "./structure"

export default defineConfig({
  name: "shadow-and-sillage",
  title: "perfumer's hollow — Behind the Bottle",
  projectId,
  dataset,
  apiVersion,
  plugins: [structureTool({ structure }), visionTool()],
  schema: { types: schemaTypes },
})
