/**
 * Query functions and query keys for Tags
 * 
 * This module provides query functions for fetching tags data from the API
 * and query key factories for TanStack Query cache management.
 */

export interface Tag {
  id: string
  name: string
  relevanceScore?: number
  [key: string]: any // Allow for additional tag properties
}

/**
 * Query key factory for tags queries.
 * Uses hierarchical structure for easy invalidation.
 */
export const queryKeys = {
  tags: {
    all: ["tags"] as const,
    lists: () => [...queryKeys.tags.all, "list"] as const,
    list: () => [...queryKeys.tags.lists()] as const,
    byName: (name: string) => [...queryKeys.tags.all, "name", name] as const,
  },
} as const

/**
 * Fetch tags by name (search).
 * Returns tags matching the search term with relevance scoring.
 * 
 * @param name - Tag name or search term
 * @returns Promise resolving to array of matching tags
 */
export async function getTag(name: string): Promise<Tag[]> {
  if (!name || !name.trim()) {
    return []
  }

  const params = new URLSearchParams({
    tag: name.trim(),
  })

  const response = await fetch(`/api/getTag?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch tags: ${response.statusText}`)
  }

  const data: Tag[] = await response.json()

  // API returns array directly
  return Array.isArray(data) ? data : []
}

