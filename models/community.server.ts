import { prisma } from "@/lib/db"

export const createCollectionShelf = async (params: {
  userId: string
  name: string
  description?: string | null
  isPublic?: boolean
  challengeId?: string | null
}) => {
  return prisma.collectionShelf.create({
    data: {
      userId: params.userId,
      name: params.name.trim().slice(0, 80),
      description: params.description ?? null,
      isPublic: params.isPublic ?? false,
      challengeId: params.challengeId ?? null,
    },
  })
}

export const listCollectionShelves = async (userId: string, viewerId?: string | null) => {
  return prisma.collectionShelf.findMany({
    where: {
      userId,
      OR: [{ isPublic: true }, ...(viewerId === userId ? [{ isPublic: false as const }] : [])],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          perfume: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
            },
          },
        },
      },
    },
  })
}

export const listPublicShelves = async (limit = 40) => {
  return prisma.collectionShelf.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        take: 4,
        orderBy: { sortOrder: "asc" },
        include: {
          perfume: {
            select: { id: true, name: true, slug: true, image: true },
          },
        },
      },
      _count: { select: { items: true } },
    },
  })
}

export const getPublicShelfById = async (shelfId: string) => {
  return prisma.collectionShelf.findFirst({
    where: { id: shelfId, isPublic: true },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          perfume: {
            select: { id: true, name: true, slug: true, image: true },
          },
        },
      },
    },
  })
}

export const addPerfumeToShelf = async (params: {
  userId: string
  shelfId: string
  perfumeId: string
  note?: string | null
}) => {
  const shelf = await prisma.collectionShelf.findFirst({
    where: { id: params.shelfId, userId: params.userId },
  })
  if (!shelf) throw new Error("Shelf not found")
  return prisma.collectionShelfItem.upsert({
    where: {
      shelfId_perfumeId: {
        shelfId: params.shelfId,
        perfumeId: params.perfumeId,
      },
    },
    create: {
      shelfId: params.shelfId,
      perfumeId: params.perfumeId,
      note: params.note ?? null,
    },
    update: {
      note: params.note ?? undefined,
    },
  })
}

export const deleteCollectionShelf = async (params: {
  userId: string
  shelfId: string
}) => {
  const shelf = await prisma.collectionShelf.findFirst({
    where: { id: params.shelfId, userId: params.userId },
    select: { id: true },
  })
  if (!shelf) throw new Error("Shelf not found")
  await prisma.collectionShelf.delete({ where: { id: shelf.id } })
  return { id: shelf.id }
}

export const createUserList = async (params: {
  userId: string
  name: string
  description?: string | null
  isPublic?: boolean
}) => {
  return prisma.userList.create({
    data: {
      userId: params.userId,
      name: params.name.trim().slice(0, 120),
      description: params.description ?? null,
      isPublic: params.isPublic ?? true,
    },
  })
}

export const addPerfumeToList = async (params: {
  userId: string
  listId: string
  perfumeId: string
  note?: string | null
}) => {
  const list = await prisma.userList.findFirst({
    where: { id: params.listId, userId: params.userId },
  })
  if (!list) throw new Error("List not found")
  return prisma.userListItem.upsert({
    where: {
      listId_perfumeId: {
        listId: params.listId,
        perfumeId: params.perfumeId,
      },
    },
    create: {
      listId: params.listId,
      perfumeId: params.perfumeId,
      note: params.note ?? null,
    },
    update: { note: params.note ?? undefined },
  })
}

export const createWearJournalEntry = async (params: {
  userId: string
  perfumeId: string
  oilPerfumeId?: string | null
  wornOn: Date
  season?: string | null
  rating?: number | null
  notes?: string | null
  weather?: string | null
  occasion?: string | null
}) => {
  const oilPerfumeId =
    params.oilPerfumeId && params.oilPerfumeId !== params.perfumeId
      ? params.oilPerfumeId
      : null
  const { recordTasteEvent } = await import("@/models/taste-event.server")
  const entry = await prisma.wearJournalEntry.create({
    data: {
      userId: params.userId,
      perfumeId: params.perfumeId,
      oilPerfumeId,
      wornOn: params.wornOn,
      season: params.season ?? null,
      rating: params.rating ?? null,
      notes: params.notes ?? null,
      weather: params.weather ?? null,
      occasion: params.occasion ?? null,
    },
  })
  const wearWeight =
    params.rating != null ? Math.min(2, Math.max(0.5, params.rating / 3)) : 1
  const wearMeta = {
    from: "wear_journal" as const,
    entryId: entry.id,
    season: params.season ?? null,
    weather: params.weather ?? null,
    occasion: params.occasion ?? null,
    layered: Boolean(oilPerfumeId),
  }
  await recordTasteEvent({
    userId: params.userId,
    perfumeId: params.perfumeId,
    eventType: "wear",
    weight: wearWeight,
    metadata: wearMeta,
  })
  if (oilPerfumeId) {
    await recordTasteEvent({
      userId: params.userId,
      perfumeId: oilPerfumeId,
      eventType: "wear",
      weight: wearWeight,
      metadata: { ...wearMeta, role: "oil" },
    })
  }
  return entry
}

export const updateWearJournalEntry = async (params: {
  userId: string
  entryId: string
  perfumeId?: string
  oilPerfumeId?: string | null
  wornOn?: Date
  season?: string | null
  rating?: number | null
  notes?: string | null
  weather?: string | null
  occasion?: string | null
}) => {
  const existing = await prisma.wearJournalEntry.findFirst({
    where: { id: params.entryId, userId: params.userId },
    select: { id: true, perfumeId: true },
  })
  if (!existing) throw new Error("Entry not found")
  const nextPerfumeId = params.perfumeId ?? existing.perfumeId
  const oilPerfumeId =
    params.oilPerfumeId === undefined
      ? undefined
      : params.oilPerfumeId && params.oilPerfumeId !== nextPerfumeId
        ? params.oilPerfumeId
        : null
  return prisma.wearJournalEntry.update({
    where: { id: params.entryId },
    data: {
      ...(params.perfumeId !== undefined ? { perfumeId: params.perfumeId } : {}),
      ...(oilPerfumeId !== undefined ? { oilPerfumeId } : {}),
      ...(params.wornOn !== undefined ? { wornOn: params.wornOn } : {}),
      ...(params.season !== undefined ? { season: params.season } : {}),
      ...(params.rating !== undefined ? { rating: params.rating } : {}),
      ...(params.notes !== undefined ? { notes: params.notes } : {}),
      ...(params.weather !== undefined ? { weather: params.weather } : {}),
      ...(params.occasion !== undefined ? { occasion: params.occasion } : {}),
    },
  })
}

export const deleteWearJournalEntry = async (params: {
  userId: string
  entryId: string
}) => {
  const existing = await prisma.wearJournalEntry.findFirst({
    where: { id: params.entryId, userId: params.userId },
    select: { id: true },
  })
  if (!existing) throw new Error("Entry not found")
  return prisma.wearJournalEntry.delete({ where: { id: params.entryId } })
}

export const listWearJournal = async (userId: string, limit = 30) => {
  return prisma.wearJournalEntry.findMany({
    where: { userId },
    orderBy: { wornOn: "desc" },
    take: limit,
    include: {
      perfume: {
        select: { id: true, name: true, slug: true, image: true },
      },
      oilPerfume: {
        select: { id: true, name: true, slug: true, image: true },
      },
    },
  })
}

export const listPublishedChallenges = async () => {
  const now = new Date()
  return prisma.communityChallenge.findMany({
    where: {
      isPublished: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { endsAt: "asc" },
    include: {
      _count: { select: { entries: true } },
    },
  })
}

export const getChallengeBySlug = async (slug: string) => {
  return prisma.communityChallenge.findUnique({
    where: { slug },
    include: {
      _count: { select: { entries: true } },
      entries: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profileSlug: true,
            },
          },
          perfume: {
            select: { id: true, name: true, slug: true, image: true },
          },
        },
      },
    },
  })
}

export const createCommunityChallenge = async (params: {
  slug: string
  title: string
  description?: string | null
  startsAt: Date
  endsAt: Date
  isPublished?: boolean
}) => {
  return prisma.communityChallenge.create({
    data: {
      slug: params.slug,
      title: params.title,
      description: params.description ?? null,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      isPublished: params.isPublished ?? false,
    },
  })
}

export const joinCommunityChallenge = async (params: {
  userId: string
  challengeId: string
  perfumeId?: string | null
  caption?: string | null
}) => {
  return prisma.communityChallengeEntry.upsert({
    where: {
      challengeId_userId: {
        challengeId: params.challengeId,
        userId: params.userId,
      },
    },
    create: {
      challengeId: params.challengeId,
      userId: params.userId,
      perfumeId: params.perfumeId ?? null,
      caption: params.caption ?? null,
    },
    update: {
      perfumeId: params.perfumeId ?? undefined,
      caption: params.caption ?? undefined,
    },
  })
}
