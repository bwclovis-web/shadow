import { prisma } from "@/lib/db"
import {
  notifySavedSearchMatch,
  type SavedSearchQuery,
} from "@/models/saved-search.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"
import { isFeatureEnabled } from "@/utils/feature-flags"

const LOOKBACK_MS = 24 * 60 * 60 * 1000

const parseQuery = (raw: unknown): SavedSearchQuery => {
  if (!raw || typeof raw !== "object") return {}
  return raw as SavedSearchQuery
}

const textIncludes = (haystack: string | null | undefined, needle: string | undefined) => {
  if (!needle?.trim()) return true
  if (!haystack) return false
  return haystack.toLowerCase().includes(needle.trim().toLowerCase())
}

/**
 * Match Premium saved searches against recent Exchange listings and new catalog perfumes.
 * Idempotent-ish via lastMatchedAt + short lookback; skips users without entitlement.
 */
export const runSavedSearchMatchPass = async (): Promise<{
  notified: number
  scanned: number
}> => {
  if (!isFeatureEnabled("savedSearches")) {
    return { notified: 0, scanned: 0 }
  }

  const searches = await prisma.savedSearch.findMany({
    where: { alertEnabled: true },
    select: {
      id: true,
      userId: true,
      name: true,
      query: true,
      lastMatchedAt: true,
    },
  })

  let notified = 0
  const now = Date.now()

  for (const search of searches) {
    const entitlement = await requireEntitlement(search.userId, "instant_alerts")
    if (!entitlement.ok) {
      const saved = await requireEntitlement(search.userId, "saved_searches")
      if (!saved.ok) continue
    }

    const query = parseQuery(search.query)
    const since = search.lastMatchedAt
      ? search.lastMatchedAt
      : new Date(now - LOOKBACK_MS)

    const alertOnListing = query.alertOnNewListing !== false
    const alertOnCatalog = query.alertOnEditorial !== false

    if (alertOnListing) {
      const listings = await prisma.userPerfume.findMany({
        where: {
          updatedAt: { gt: since },
          available: { not: "0" },
          ...(query.perfumeId ? { perfumeId: query.perfumeId } : {}),
          perfume: {
            ...(query.houseId ? { perfumeHouseId: query.houseId } : {}),
            ...(query.perfumeName
              ? { name: { contains: query.perfumeName, mode: "insensitive" } }
              : {}),
            ...(query.q
              ? { name: { contains: query.q, mode: "insensitive" } }
              : {}),
            ...(query.houseName
              ? {
                  perfumeHouse: {
                    name: { contains: query.houseName, mode: "insensitive" },
                  },
                }
              : {}),
            ...(query.noteIds?.length
              ? {
                  perfumeNoteRelations: {
                    some: { noteId: { in: query.noteIds } },
                  },
                }
              : {}),
            ...(query.notes?.length
              ? {
                  perfumeNoteRelations: {
                    some: {
                      note: {
                        OR: query.notes.map((n) => ({
                          name: { contains: n, mode: "insensitive" as const },
                        })),
                      },
                    },
                  },
                }
              : {}),
          },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          userId: true,
          perfume: {
            select: {
              id: true,
              name: true,
              slug: true,
              perfumeHouse: { select: { name: true } },
            },
          },
        },
      })

      for (const listing of listings) {
        if (listing.userId === search.userId) continue
        const perfumeName = listing.perfume.name
        if (!textIncludes(perfumeName, query.perfumeName) && query.perfumeName) continue
        await notifySavedSearchMatch({
          userId: search.userId,
          savedSearchId: search.id,
          title: `Match: ${search.name}`,
          message: `${perfumeName} is available on The Exchange.`,
          payload: {
            listingId: listing.id,
            perfumeId: listing.perfume.id,
            perfumeSlug: listing.perfume.slug,
            kind: "exchange_listing",
          },
        })
        notified += 1
        break
      }
    }

    if (alertOnCatalog && (query.source === "archive" || !query.source)) {
      const perfumes = await prisma.perfume.findMany({
        where: {
          createdAt: { gt: since },
          isPending: false,
          ...(query.perfumeId ? { id: query.perfumeId } : {}),
          ...(query.houseId ? { perfumeHouseId: query.houseId } : {}),
          ...(query.perfumeName || query.q
            ? {
                name: {
                  contains: query.perfumeName || query.q || "",
                  mode: "insensitive",
                },
              }
            : {}),
          ...(query.houseName
            ? {
                perfumeHouse: {
                  name: { contains: query.houseName, mode: "insensitive" },
                },
              }
            : {}),
          ...(query.noteIds?.length
            ? {
                perfumeNoteRelations: {
                  some: { noteId: { in: query.noteIds } },
                },
              }
            : {}),
        },
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      })

      for (const perfume of perfumes) {
        await notifySavedSearchMatch({
          userId: search.userId,
          savedSearchId: search.id,
          title: `Catalog match: ${search.name}`,
          message: `${perfume.name} was added to The Archive.`,
          payload: {
            perfumeId: perfume.id,
            perfumeSlug: perfume.slug,
            kind: "catalog_perfume",
          },
        })
        notified += 1
        break
      }
    }
  }

  return { notified, scanned: searches.length }
}
