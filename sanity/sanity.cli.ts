import { config as loadEnv } from "dotenv"
import { defineCliConfig } from "sanity/cli"

loadEnv({ path: ".env.local" })
loadEnv()

const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  ""

const dataset =
  process.env.SANITY_STUDIO_DATASET ??
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  "production"

const apiVersion =
  process.env.SANITY_STUDIO_API_VERSION ??
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ??
  "2025-05-17"

export default defineCliConfig({
  api: { projectId, dataset },
  studioHost: "shadow-and-sillage",
  autoUpdates: true,
  vite: {
    define: {
      "process.env.NEXT_PUBLIC_SANITY_PROJECT_ID": JSON.stringify(projectId),
      "process.env.NEXT_PUBLIC_SANITY_DATASET": JSON.stringify(dataset),
      "process.env.NEXT_PUBLIC_SANITY_API_VERSION": JSON.stringify(apiVersion),
    },
  },
})
