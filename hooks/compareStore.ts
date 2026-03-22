/**
 * Client-side compare list for perfume cards (CF-001). Persists to `localStorage`.
 * CF-003: URL `?ids=` hydrates via `setItems`; tray stays in sync with `localStorage`.
 *
 * @see docs/compare-client.md
 */
import {
  COMPARE_MAX_ITEMS,
  COMPARE_STORAGE_KEY,
} from "@/constants/compare"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export { COMPARE_MAX_ITEMS, COMPARE_STORAGE_KEY }

export interface CompareItem {
  /** Perfume id — unique key for dedupe */
  id: string
  /** For future links / CF-002 */
  slug: string
  /** Display name in tray */
  name: string
  /** Optional card image URL (remote or local path) */
  image?: string
}

interface CompareState {
  items: CompareItem[]
  add: (item: CompareItem) => void
  setItems: (items: CompareItem[]) => void
  remove: (id: string) => void
  toggle: (item: CompareItem) => void
  clear: () => void
  isSelected: (id: string) => boolean
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const { items } = get()
        if (items.some((i) => i.id === item.id)) {
          set({
            items: items.map((i) => (i.id === item.id ? { ...i, ...item } : i)),
          })
          return
        }
        if (items.length >= COMPARE_MAX_ITEMS) return
        set({ items: [...items, item] })
      },
      setItems: (incoming) => {
        const seen = new Set<string>()
        const next: CompareItem[] = []
        for (const item of incoming) {
          const id = typeof item.id === "string" ? item.id.trim() : ""
          if (!id || seen.has(id)) continue
          seen.add(id)
          next.push({
            ...item,
            id,
            slug: item.slug?.trim() ?? "",
            name: item.name?.trim() || id,
          })
          if (next.length >= COMPARE_MAX_ITEMS) break
        }
        set({ items: next })
      },
      remove: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) })
      },
      toggle: (item) => {
        const { items } = get()
        if (items.some((i) => i.id === item.id)) {
          set({ items: items.filter((i) => i.id !== item.id) })
          return
        }
        if (items.length >= COMPARE_MAX_ITEMS) return
        set({ items: [...items, item] })
      },
      clear: () => set({ items: [] }),
      isSelected: (id) => get().items.some((i) => i.id === id),
    }),
    {
      name: COMPARE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
)
