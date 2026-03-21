import type { Metadata } from "next"

import { ScraperPageClient } from "./ScraperPageClient"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "House Scraper | Admin",
    description: "Configure and run the generic perfume-house scraper.",
  }
}

const ScraperPage = () => <ScraperPageClient />

export default ScraperPage
