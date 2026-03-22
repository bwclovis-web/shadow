/**
 * Client-side compare list for perfume cards (CF-001). Persists to `localStorage`.
 * CF-002 should read from this store until CF-003 adds URL sync.
 *
 * @see docs/compare-client.md
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const COMPARE_MAX_ITEMS = 3

/** Persist key in localStorage; keep stable for CF-003 migration. */
export const COMPARE_STORAGE_KEY = "shadows-compare-tray"

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
