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
      useCdn: true,
      perspective: "published",
    })
  }
  return sanityClient
}

export const sanityFetch = async <T>({
  query,
  params = {},
  revalidate = 3600,
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
  return client.fetch<T>(query, params, {
    next: {
      revalidate: tags.length > 0 ? false : revalidate,
      ...(tags.length > 0 ? { tags } : {}),
    },
  })
}
