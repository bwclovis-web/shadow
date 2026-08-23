import { createClient, type QueryParams, type SanityClient } from "next-sanity"

import { apiVersion, dataset, isSanityConfigured, projectId } from "@/sanity/env"

let sanityClient: SanityClient | null = null

const getSanityClient = (): SanityClient | null => {
  if (!isSanityConfigured) return null
  if (!sanityClient) {
    sanityClient = createClient({
      projectId,
      dataset,
      apiVersion,
      // CDN can lag briefly after publish; skip in local so Studio → /journal is snappy.
      useCdn: process.env.NODE_ENV === "production",
      perspective: "published",
    })
  }
  return sanityClient
}

export const sanityFetch = async <T>({
  query,
  params = {},
  revalidate = 60,
  tags = [],
}: {
  query: string
  params?: QueryParams
  revalidate?: number | false
  tags?: string[]
}): Promise<T> => {
  const client = getSanityClient()
  if (!client) {
    return [] as T
  }
  // Keep time-based revalidation even when tags are set. Tags alone with
  // `revalidate: false` freeze an empty journal until a webhook fires.
  return client.fetch<T>(query, params, {
    next: {
      revalidate,
      ...(tags.length > 0 ? { tags } : {}),
    },
  })
}
