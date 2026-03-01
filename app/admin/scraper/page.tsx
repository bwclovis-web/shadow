import type { Metadata } from "next"

import { ScraperPageClient } from "./ScraperPageClient"

export const metadata: Metadata = {
  title: "House Scraper | Admin",
  description: "Configure and run the generic perfume-house scraper.",
}

export const ROUTE_PATH = "/admin/scraper" as const

const ScraperPage = () => <ScraperPageClient />

export default ScraperPage
