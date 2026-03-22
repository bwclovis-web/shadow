/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
  COMPARE_MAX_ITEMS,
  COMPARE_STORAGE_KEY,
  useCompareStore,
} from "./compareStore"

const sample = (n: number) => ({
  id: `id-${n}`,
  slug: `slug-${n}`,
  name: `Perfume ${n}`,
  image: `/img-${n}.jpg`,
})

function resetStore() {
  localStorage.clear()
  useCompareStore.persist.clearStorage()
  useCompareStore.setState({ items: [] })
}

describe("compareStore", () => {
  beforeEach(() => {
    resetStore()
  })

  it("adds items up to the cap", () => {
    const s = useCompareStore.getState()
    for (let i = 0; i < COMPARE_MAX_ITEMS; i++) s.add(sample(i))
    expect(useCompareStore.getState().items).toHaveLength(COMPARE_MAX_ITEMS)
    s.add(sample(99))
    expect(useCompareStore.getState().items).toHaveLength(COMPARE_MAX_ITEMS)
  })

  it("dedupes by id on add and refreshes fields", () => {
    const s = useCompareStore.getState()
    s.add({ id: "a", slug: "s", name: "One" })
    s.add({ id: "a", slug: "s2", name: "Updated" })
    const items = useCompareStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe("Updated")
    expect(items[0].slug).toBe("s2")
  })

  it("toggle removes when selected and respects max when adding", () => {
    const s = useCompareStore.getState()
    s.toggle(sample(1))
    expect(s.isSelected("id-1")).toBe(true)
    s.toggle(sample(1))
    expect(s.isSelected("id-1")).toBe(false)
    for (let i = 0; i < COMPARE_MAX_ITEMS; i++) s.add(sample(i))
    s.toggle(sample(100))
    expect(useCompareStore.getState().items).toHaveLength(COMPARE_MAX_ITEMS)
  })

  it("remove and clear", () => {
    const s = useCompareStore.getState()
    s.add(sample(1))
    s.add(sample(2))
    s.remove("id-1")
    expect(useCompareStore.getState().items).toHaveLength(1)
    s.clear()
    expect(useCompareStore.getState().items).toHaveLength(0)
  })

  it("setItems replaces list, dedupes, and enforces max", () => {
    const s = useCompareStore.getState()
    s.setItems([
      sample(1),
      sample(1),
      sample(2),
      sample(3),
      sample(4),
    ])
    const items = useCompareStore.getState().items
    expect(items).toHaveLength(COMPARE_MAX_ITEMS)
    expect(items.map((i) => i.id)).toEqual(["id-1", "id-2", "id-3"])
  })

  it("writes persisted slice to localStorage", () => {
    useCompareStore.getState().add(sample(1))
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { state: { items: unknown[] } }
    expect(parsed.state.items).toHaveLength(1)
  })
})
