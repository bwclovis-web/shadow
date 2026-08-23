export type PerfumeOption = {
  perfumeId: string
  name: string
  slug: string
}

export type ShelfItem = {
  id: string
  perfumeId: string
  note: string | null
  perfume: { id: string; name: string; slug: string; image: string | null }
}

export type Shelf = {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  items: ShelfItem[]
}

export type JournalEntry = {
  id: string
  wornOn: string
  season: string | null
  rating: number | null
  notes: string | null
  perfume: { id: string; name: string; slug: string; image: string | null }
}

export type Challenge = {
  id: string
  title: string
  description: string | null
  endsAt: string
  _count: { entries: number }
}

export type CommunityTabId = "shelves" | "journal" | "challenges" | "alerts"
